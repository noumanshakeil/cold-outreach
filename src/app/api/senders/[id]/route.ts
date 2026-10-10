import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret, maskSecret } from "@/lib/crypto";

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).nullable().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().min(1).optional(),
  smtpSecure: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.senderAccount.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const sender = await prisma.senderAccount.update({
    where: { id },
    data: {
      label: d.label,
      fromEmail: d.fromEmail?.toLowerCase(),
      fromName: d.fromName === undefined ? undefined : d.fromName,
      smtpHost: d.smtpHost,
      smtpPort: d.smtpPort,
      smtpUser: d.smtpUser,
      smtpSecure: d.smtpSecure,
      ...(d.smtpPass ? { smtpPassEnc: encryptSecret(d.smtpPass) } : {}),
    },
  });
  return NextResponse.json({
    sender: {
      id: sender.id,
      label: sender.label,
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      type: sender.type,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      smtpSecure: sender.smtpSecure,
      hasPassword: Boolean(sender.smtpPassEnc),
      passwordMasked: maskSecret(sender.smtpPassEnc),
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.senderAccount.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.senderAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
