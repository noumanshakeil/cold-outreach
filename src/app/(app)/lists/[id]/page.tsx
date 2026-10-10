"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { KeyboardEvent, useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
};

type ListData = {
  id: string;
  name: string;
  recipients: Recipient[];
};

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const [list, setList] = useState<ListData | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  async function load() {
    const res = await fetch(`/api/lists/${params.id}`);
    const data = await res.json();
    if (res.ok) setList(data.list);
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function addEmail() {
    const value = email.trim();
    if (!value) return;
    setError("");
    const res = await fetch(`/api/lists/${params.id}/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not add email");
      return;
    }
    setEmail("");
    await load();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addEmail();
    }
  }

  async function removeRecipient(recipientId: string) {
    await fetch(
      `/api/lists/${params.id}/recipients?recipientId=${encodeURIComponent(recipientId)}`,
      { method: "DELETE" }
    );
    await load();
  }

  function onCsv(file: File) {
    setImportMsg("");
    setError("");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.data.length > 5000) {
          setError("CSV limited to 5000 rows");
          return;
        }
        const rows = results.data.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            normalized[k.trim().toLowerCase()] = String(v ?? "").trim();
          }
          const emailVal = normalized.email || normalized["e-mail"] || "";
          const name = normalized.name || normalized.fullname || undefined;
          const company = normalized.company || normalized.organization || undefined;
          const customFields: Record<string, string> = {};
          for (const [k, v] of Object.entries(normalized)) {
            if (["email", "e-mail", "name", "fullname", "company", "organization"].includes(k)) {
              continue;
            }
            if (v) customFields[k] = v;
          }
          return { email: emailVal, name, company, customFields };
        });

        const res = await fetch(`/api/lists/${params.id}/recipients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Import failed");
          return;
        }
        setImportMsg(`Imported ${data.added}, skipped ${data.skipped}`);
        await load();
      },
    });
  }

  if (!list) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <PageHeader
        title={list.name}
        description="Type an email and press Enter to add. Or import a CSV with an email column."
        action={
          <Link href="/lists">
            <Button variant="secondary">Back to lists</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <Label>Add email</Label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="person@company.com then press Enter"
          autoFocus
        />
        <ErrorText>{error}</ErrorText>
        {importMsg ? <p className="mt-2 text-sm text-[var(--accent)]">{importMsg}</p> : null}

        <div className="mt-4">
          <Label>Import CSV</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsv(f);
            }}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Required column: email. Optional: name, company. Other columns become {"{{custom.column}}"} merge fields.
          </p>
        </div>
      </Card>

      {list.recipients.length === 0 ? (
        <EmptyState
          title="No recipients"
          description="Add emails above — Enter adds them instantly."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-black/[0.02] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.recipients.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{r.name || "—"}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{r.company || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-[var(--danger)]"
                      onClick={() => removeRecipient(r.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
