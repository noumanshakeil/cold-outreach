import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { htmlToPlainText } from "@/lib/merge";

const schema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const drafts = await prisma.draft.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ drafts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const textBody =
    parsed.data.textBody?.trim() || htmlToPlainText(parsed.data.htmlBody);
  const draft = await prisma.draft.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      subject: parsed.data.subject,
      htmlBody: parsed.data.htmlBody,
      textBody,
    },
  });
  return NextResponse.json({ draft }, { status: 201 });
}
