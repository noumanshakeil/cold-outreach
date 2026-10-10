"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";

type Job = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  status: "pending" | "sending" | "sent" | "failed";
  error: string | null;
  aiNote: string | null;
  sentAt: string | null;
  subject: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  mode: string;
  delayMs: number;
  aiEnabled: boolean;
  subject: string;
  counts: { pending: number; sending: number; sent: number; failed: number };
  jobs: Job[];
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  async function load() {
    const res = await fetch(`/api/campaigns/${params.id}`);
    const data = await res.json();
    if (res.ok) setCampaign(data.campaign);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [params.id]);

  async function retryFailed() {
    await fetch(`/api/campaigns/${params.id}/retry`, { method: "POST" });
    await load();
  }

  async function cancel() {
    if (!confirm("Cancel remaining pending sends?")) return;
    await fetch(`/api/campaigns/${params.id}/cancel`, { method: "POST" });
    await load();
  }

  if (!campaign) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  const total =
    campaign.counts.pending +
    campaign.counts.sending +
    campaign.counts.sent +
    campaign.counts.failed;
  const done = campaign.counts.sent + campaign.counts.failed;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.status} · ${campaign.mode} mode · ${campaign.delayMs / 1000}s delay${campaign.aiEnabled ? " · AI on" : ""}`}
        action={
          <div className="flex gap-2">
            {campaign.counts.failed > 0 ? (
              <Button type="button" variant="secondary" onClick={retryFailed}>
                Retry failed
              </Button>
            ) : null}
            {campaign.status === "running" || campaign.status === "queued" ? (
              <Button type="button" variant="danger" onClick={cancel}>
                Cancel
              </Button>
            ) : null}
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span>
            {campaign.counts.sent} sent · {campaign.counts.failed} failed ·{" "}
            {campaign.counts.pending + campaign.counts.sending} remaining
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">Subject: {campaign.subject}</p>
      </Card>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">Recipient</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {campaign.jobs.map((j) => (
              <tr key={j.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-2">
                  <div>{j.recipientEmail}</div>
                  {j.recipientName ? (
                    <div className="text-xs text-[var(--muted)]">{j.recipientName}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2 capitalize">{j.status}</td>
                <td className="px-4 py-2 text-xs text-[var(--muted)]">
                  {j.error || j.aiNote || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
