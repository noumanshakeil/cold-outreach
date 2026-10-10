import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { htmlToPlainText } from "@/lib/merge";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const draft = await prisma.draft.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.draft.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const htmlBody = parsed.data.htmlBody ?? existing.htmlBody;
  const textBody =
    parsed.data.textBody !== undefined
      ? parsed.data.textBody
      : parsed.data.htmlBody
        ? htmlToPlainText(htmlBody)
        : undefined;

  const draft = await prisma.draft.update({
    where: { id },
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      htmlBody: parsed.data.htmlBody,
      textBody,
    },
  });
  return NextResponse.json({ draft });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.draft.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
