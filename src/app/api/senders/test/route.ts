import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { testSmtpConnection } from "@/lib/smtp";

const schema = z.object({
  senderId: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
});

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

  let host = parsed.data.host;
  let port = parsed.data.port;
  let secure = parsed.data.secure ?? true;
  let user = parsed.data.user;
  let pass = parsed.data.pass;

  if (parsed.data.senderId) {
    const sender = await prisma.senderAccount.findFirst({
      where: { id: parsed.data.senderId, userId: session.user.id },
    });
    if (!sender || !sender.smtpHost || !sender.smtpPort || !sender.smtpUser || !sender.smtpPassEnc) {
      return NextResponse.json({ error: "Sender not found or incomplete" }, { status: 404 });
    }
    host = sender.smtpHost;
    port = sender.smtpPort;
    secure = sender.smtpSecure;
    user = sender.smtpUser;
    pass = decryptSecret(sender.smtpPassEnc);
  }

  if (!host || !port || !user || !pass) {
    return NextResponse.json({ error: "Missing SMTP fields" }, { status: 400 });
  }

  const result = await testSmtpConnection({ host, port, secure, user, pass });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
