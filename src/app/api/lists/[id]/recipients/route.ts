import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidEmail } from "@/lib/merge";

type Ctx = { params: Promise<{ id: string }> };

const addSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string(),
        name: z.string().optional(),
        company: z.string().optional(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .max(5000),
});

async function ownedList(userId: string, id: string) {
  return prisma.recipientList.findFirst({ where: { id, userId } });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const list = await ownedList(session.user.id, id);
  if (!list) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  if (body && Array.isArray(body.rows)) {
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid CSV payload (max 5000 rows)" },
        { status: 400 }
      );
    }
    let added = 0;
    let skipped = 0;
    for (const row of parsed.data.rows) {
      const email = row.email.trim().toLowerCase();
      if (!isValidEmail(email)) {
        skipped += 1;
        continue;
      }
      try {
        await prisma.recipient.create({
          data: {
            listId: id,
            email,
            name: row.name?.trim() || null,
            company: row.company?.trim() || null,
            customFields: (row.customFields ?? {}) as Prisma.InputJsonValue,
          },
        });
        added += 1;
      } catch {
        skipped += 1;
      }
    }
    await prisma.recipientList.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ added, skipped });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const recipient = await prisma.recipient.create({
      data: {
        listId: id,
        email,
        name: parsed.data.name,
        company: parsed.data.company,
        customFields: (parsed.data.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
    await prisma.recipientList.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ recipient }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Email already on this list" }, { status: 409 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const list = await ownedList(session.user.id, id);
  if (!list) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get("recipientId");
  if (!recipientId) {
    return NextResponse.json({ error: "recipientId required" }, { status: 400 });
  }
  await prisma.recipient.deleteMany({
    where: { id: recipientId, listId: id },
  });
  return NextResponse.json({ ok: true });
}
