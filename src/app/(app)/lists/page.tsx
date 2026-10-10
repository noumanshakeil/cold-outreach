"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";

type ListItem = {
  id: string;
  name: string;
  recipientCount: number;
  updatedAt: string;
};

export default function ListsPage() {
  const [lists, setLists] = useState<ListItem[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/lists");
    const data = await res.json();
    setLists(data.lists ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create list");
      return;
    }
    setName("");
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Lists"
        description="Build recipient lists. Open a list to add emails with Enter or import a CSV."
      />

      <Card className="mb-6 max-w-xl">
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label>New list name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit">Create</Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      {lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Create a list, then type emails and press Enter to add them."
        />
      ) : (
        <div className="space-y-2">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/lists/${l.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 hover:border-[var(--accent)]"
            >
              <div>
                <p className="font-medium">{l.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {l.recipientCount} recipient{l.recipientCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm text-[var(--accent)]">Open</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
