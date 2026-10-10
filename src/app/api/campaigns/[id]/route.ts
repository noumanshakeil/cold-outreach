import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kickCampaignRunner } from "@/lib/send-runner";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user.id },
    include: {
      jobs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          status: true,
          error: true,
          aiNote: true,
          sentAt: true,
          senderAccountId: true,
          subject: true,
        },
      },
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const counts = { pending: 0, sending: 0, sent: 0, failed: 0 };
  for (const j of campaign.jobs) counts[j.status] += 1;

  // Resume runner if still has pending work (e.g. after process restart)
  if (
    (campaign.status === "queued" || campaign.status === "running") &&
    counts.pending > 0
  ) {
    kickCampaignRunner(campaign.id);
  }

  return NextResponse.json({ campaign: { ...campaign, counts } });
}
