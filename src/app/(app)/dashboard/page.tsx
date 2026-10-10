import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Button } from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [senders, lists, drafts, campaigns] = await Promise.all([
    prisma.senderAccount.count({ where: { userId } }),
    prisma.recipientList.count({ where: { userId } }),
    prisma.draft.count({ where: { userId } }),
    prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { jobs: { select: { status: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Configure senders, build recipient lists, draft messages, and launch campaigns."
        action={
          <Link href="/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--muted)]">Senders</p>
          <p className="mt-1 text-3xl font-[family-name:var(--font-display)]">{senders}</p>
          <Link href="/senders" className="mt-2 inline-block text-sm text-[var(--accent)]">
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted)]">Lists</p>
          <p className="mt-1 text-3xl font-[family-name:var(--font-display)]">{lists}</p>
          <Link href="/lists" className="mt-2 inline-block text-sm text-[var(--accent)]">
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted)]">Drafts</p>
          <p className="mt-1 text-3xl font-[family-name:var(--font-display)]">{drafts}</p>
          <Link href="/drafts" className="mt-2 inline-block text-sm text-[var(--accent)]">
            Manage →
          </Link>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-medium">Recent campaigns</h2>
      {campaigns.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No campaigns yet. Add a sender and a list, then launch your first send.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const sent = c.jobs.filter((j) => j.status === "sent").length;
            const failed = c.jobs.filter((j) => j.status === "failed").length;
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 hover:border-[var(--accent)]"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {c.status} · {sent} sent · {failed} failed · {c.jobs.length} total
                  </p>
                </div>
                <span className="text-sm text-[var(--accent)]">View</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
