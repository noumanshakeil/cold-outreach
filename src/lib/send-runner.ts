import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { applyMergeTags, htmlToPlainText } from "@/lib/merge";
import { rewriteEmailForRecipient } from "@/lib/ai";
import { sendViaSender } from "@/lib/smtp";

const runningCampaigns = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function kickCampaignRunner(campaignId: string) {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);
  void runCampaign(campaignId).finally(() => {
    runningCampaigns.delete(campaignId);
  });
}

async function runCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { user: true },
  });
  if (!campaign) return;
  if (campaign.status === "cancelled" || campaign.status === "completed") return;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "running",
      startedAt: campaign.startedAt ?? new Date(),
    },
  });

  let llmKey: string | null = null;
  if (campaign.aiEnabled && campaign.user.llmApiKeyEnc && campaign.user.llmProvider) {
    try {
      llmKey = decryptSecret(campaign.user.llmApiKeyEnc);
    } catch {
      llmKey = null;
    }
  }

  while (true) {
    const fresh = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!fresh || fresh.status === "cancelled") break;

    const job = await prisma.sendJob.findFirst({
      where: { campaignId, status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { sender: true },
    });

    if (!job) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "completed", completedAt: new Date() },
      });
      break;
    }

    await prisma.sendJob.update({
      where: { id: job.id },
      data: { status: "sending" },
    });

    const fields = {
      email: job.recipientEmail,
      name: job.recipientName,
      company: job.recipientCompany,
      customFields: (job.customFields ?? {}) as Record<string, unknown>,
    };

    let subject = applyMergeTags(campaign.subject, fields);
    let html = applyMergeTags(campaign.htmlBody, fields);
    let text =
      applyMergeTags(campaign.textBody, fields) || htmlToPlainText(html);
    let aiNote: string | null = null;

    if (campaign.aiEnabled && llmKey && campaign.user.llmProvider) {
      try {
        const rewritten = await rewriteEmailForRecipient({
          provider: campaign.user.llmProvider,
          apiKey: llmKey,
          subject,
          html,
          text,
          fields,
        });
        subject = rewritten.subject;
        html = rewritten.html;
        text = rewritten.text;
      } catch (e) {
        aiNote = e instanceof Error ? e.message : "AI rewrite failed; sent merge-only";
      }
    } else if (campaign.aiEnabled) {
      aiNote = "AI enabled but no valid LLM key; sent merge-only";
    }

    try {
      await sendViaSender(job.sender, {
        to: job.recipientEmail,
        subject,
        html,
        text,
      });
      await prisma.sendJob.update({
        where: { id: job.id },
        data: {
          status: "sent",
          subject,
          htmlBody: html,
          textBody: text,
          aiNote,
          sentAt: new Date(),
          error: null,
        },
      });
    } catch (e) {
      await prisma.sendJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          subject,
          htmlBody: html,
          textBody: text,
          aiNote,
          error: e instanceof Error ? e.message : "Send failed",
        },
      });
    }

    const remaining = await prisma.sendJob.count({
      where: { campaignId, status: "pending" },
    });
    if (remaining > 0 && fresh.delayMs > 0) {
      await sleep(fresh.delayMs);
    }
  }
}
