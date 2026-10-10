import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kickCampaignRunner } from "@/lib/send-runner";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await prisma.sendJob.updateMany({
    where: { campaignId: id, status: "failed" },
    data: { status: "pending", error: null },
  });

  await prisma.campaign.update({
    where: { id },
    data: { status: "queued", completedAt: null },
  });

  kickCampaignRunner(id);

  return NextResponse.json({ retried: result.count });
}
