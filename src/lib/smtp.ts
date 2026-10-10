import nodemailer from "nodemailer";
import { decryptSecret } from "@/lib/crypto";
import type { SenderAccount } from "@prisma/client";

export function createTransportFromSender(sender: SenderAccount) {
  if (sender.type !== "smtp") {
    throw new Error("Gmail OAuth sending is not implemented yet");
  }
  if (!sender.smtpHost || !sender.smtpPort || !sender.smtpUser || !sender.smtpPassEnc) {
    throw new Error("Incomplete SMTP configuration");
  }
  const pass = decryptSecret(sender.smtpPassEnc);
  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    auth: {
      user: sender.smtpUser,
      pass,
    },
  });
}

export async function testSmtpConnection(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transport = nodemailer.createTransport({
      host: input.host,
      port: input.port,
      secure: input.secure,
      auth: { user: input.user, pass: input.pass },
    });
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMTP test failed" };
  }
}

export async function sendViaSender(
  sender: SenderAccount,
  mail: { to: string; subject: string; html: string; text: string }
) {
  const transport = createTransportFromSender(sender);
  await transport.sendMail({
    from: sender.fromName
      ? `"${sender.fromName}" <${sender.fromEmail}>`
      : sender.fromEmail,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
