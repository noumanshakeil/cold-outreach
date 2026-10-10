import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret, maskSecret } from "@/lib/crypto";

const schema = z.object({
  provider: z.enum(["openai", "anthropic"]).nullable(),
  apiKey: z.string().min(1).optional(),
  clearKey: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { llmProvider: true, llmApiKeyEnc: true },
  });
  return NextResponse.json({
    provider: user?.llmProvider ?? null,
    hasKey: Boolean(user?.llmApiKeyEnc),
    keyMasked: maskSecret(user?.llmApiKeyEnc),
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data: {
    llmProvider?: string | null;
    llmApiKeyEnc?: string | null;
  } = {
    llmProvider: parsed.data.provider,
  };
  if (parsed.data.clearKey) {
    data.llmApiKeyEnc = null;
  } else if (parsed.data.apiKey) {
    data.llmApiKeyEnc = encryptSecret(parsed.data.apiKey);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
