import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/merge";
import { kickCampaignRunner } from "@/lib/send-runner";

const recipientSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  company: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  draftId: z.string().optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().optional(),
  listId: z.string().optional(),
  csvRecipients: z.array(recipientSchema).max(5000).optional(),
  senderIds: z.array(z.string()).min(1),
  mode: z.enum(["single", "rotate"]),
  delayMs: z.number().int().min(0).max(3_600_000).default(30_000),
  aiEnabled: z.boolean().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { jobs: true },
      },
      jobs: {
        select: { status: true },
      },
    },
    take: 50,
  });

  return NextResponse.json({
    campaigns: campaigns.map((c) => {
      const counts = { pending: 0, sending: 0, sent: 0, failed: 0 };
      for (const j of c.jobs) counts[j.status] += 1;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        mode: c.mode,
        aiEnabled: c.aiEnabled,
        createdAt: c.createdAt,
        totalJobs: c._count.jobs,
        counts,
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(`campaign:${session.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many campaigns started" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.mode === "single" && data.senderIds.length !== 1) {
    return NextResponse.json(
      { error: "Single mode requires exactly one sender" },
      { status: 400 }
    );
  }

  const senders = await prisma.senderAccount.findMany({
    where: { userId: session.user.id, id: { in: data.senderIds } },
  });
  if (senders.length !== data.senderIds.length) {
    return NextResponse.json({ error: "Invalid sender selection" }, { status: 400 });
  }

  let subject = data.subject;
  let htmlBody = data.htmlBody;
  let textBody = data.textBody ?? "";

  if (data.draftId) {
    const draft = await prisma.draft.findFirst({
      where: { id: data.draftId, userId: session.user.id },
    });
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    subject = draft.subject;
    htmlBody = draft.htmlBody;
    textBody = draft.textBody;
  }

  if (!subject || !htmlBody) {
    return NextResponse.json({ error: "Subject and body required" }, { status: 400 });
  }

  type Rec = {
    email: string;
    name?: string | null;
    company?: string | null;
    customFields?: Record<string, unknown>;
  };
  const recipients: Rec[] = [];
  const seen = new Set<string>();

  if (data.listId) {
    const list = await prisma.recipientList.findFirst({
      where: { id: data.listId, userId: session.user.id },
      include: { recipients: true },
    });
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    for (const r of list.recipients) {
      const email = r.email.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      recipients.push({
        email,
        name: r.name,
        company: r.company,
        customFields: (r.customFields ?? {}) as Record<string, unknown>,
      });
    }
  }

  if (data.csvRecipients?.length) {
    for (const r of data.csvRecipients) {
      const email = r.email.trim().toLowerCase();
      if (!isValidEmail(email) || seen.has(email)) continue;
      seen.add(email);
      recipients.push({
        email,
        name: r.name,
        company: r.company,
        customFields: r.customFields ?? {},
      });
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }
  if (recipients.length > 5000) {
    return NextResponse.json({ error: "Max 5000 recipients per campaign" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: session.user.id,
      name: data.name,
      subject,
      htmlBody,
      textBody,
      mode: data.mode,
      delayMs: data.delayMs,
      aiEnabled: data.aiEnabled,
      status: "queued",
      senderIds: data.senderIds,
      listId: data.listId,
      jobs: {
        create: recipients.map((r, i) => {
          const senderId =
            data.mode === "single"
              ? data.senderIds[0]
              : data.senderIds[i % data.senderIds.length];
          return {
            senderAccountId: senderId!,
            recipientEmail: r.email,
            recipientName: r.name ?? null,
            recipientCompany: r.company ?? null,
            customFields: (r.customFields ?? {}) as Prisma.InputJsonValue,
            status: "pending" as const,
          };
        }) satisfies Prisma.SendJobUncheckedCreateWithoutCampaignInput[],
      },
    },
  });

  kickCampaignRunner(campaign.id);

  return NextResponse.json({ campaign: { id: campaign.id } }, { status: 201 });
}
