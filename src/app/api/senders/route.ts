import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret, maskSecret } from "@/lib/crypto";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  fromEmail: z.string().email(),
  fromName: z.string().max(100).optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpSecure: z.boolean().default(true),
});

function publicSender(s: {
  id: string;
  label: string;
  fromEmail: string;
  fromName: string | null;
  type: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean;
  smtpPassEnc: string | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    label: s.label,
    fromEmail: s.fromEmail,
    fromName: s.fromName,
    type: s.type,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpUser: s.smtpUser,
    smtpSecure: s.smtpSecure,
    hasPassword: Boolean(s.smtpPassEnc),
    passwordMasked: maskSecret(s.smtpPassEnc),
    createdAt: s.createdAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const senders = await prisma.senderAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ senders: senders.map(publicSender) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;
  const sender = await prisma.senderAccount.create({
    data: {
      userId: session.user.id,
      type: "smtp",
      label: data.label,
      fromEmail: data.fromEmail.toLowerCase(),
      fromName: data.fromName,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpUser: data.smtpUser,
      smtpPassEnc: encryptSecret(data.smtpPass),
      smtpSecure: data.smtpSecure,
    },
  });
  return NextResponse.json({ sender: publicSender(sender) }, { status: 201 });
}
