import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lists = await prisma.recipientList.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { recipients: true } } },
  });
  return NextResponse.json({
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      recipientCount: l._count.recipients,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
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
  const list = await prisma.recipientList.create({
    data: { userId: session.user.id, name: parsed.data.name },
  });
  return NextResponse.json({ list }, { status: 201 });
}
