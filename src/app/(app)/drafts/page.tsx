"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader } from "@/components/ui";

type Draft = {
  id: string;
  name: string;
  subject: string;
  updatedAt: string;
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    void fetch("/api/drafts")
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts ?? []));
  }, []);

  return (
    <div>
      <PageHeader
        title="Drafts"
        description="Save reusable email templates with HTML, plain text, and merge tags."
        action={
          <Link href="/drafts/new">
            <Button>New draft</Button>
          </Link>
        }
      />

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          description="Create a draft with {{name}} / {{company}} merge tags, then use it in a campaign."
        />
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Link
              key={d.id}
              href={`/drafts/${d.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 hover:border-[var(--accent)]"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-[var(--muted)]">{d.subject}</p>
              </div>
              <span className="text-sm text-[var(--accent)]">Edit</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
