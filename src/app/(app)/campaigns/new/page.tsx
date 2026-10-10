"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";

type Draft = { id: string; name: string; subject: string };
type List = { id: string; name: string; recipientCount: number };
type Sender = { id: string; label: string; fromEmail: string };

export default function NewCampaignPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [name, setName] = useState("");
  const [draftId, setDraftId] = useState("");
  const [listId, setListId] = useState("");
  const [mode, setMode] = useState<"single" | "rotate">("single");
  const [selectedSenders, setSelectedSenders] = useState<string[]>([]);
  const [delaySec, setDelaySec] = useState("30");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [csvRecipients, setCsvRecipients] = useState<
    { email: string; name?: string; company?: string; customFields?: Record<string, string> }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/drafts").then((r) => r.json()),
      fetch("/api/lists").then((r) => r.json()),
      fetch("/api/senders").then((r) => r.json()),
    ]).then(([d, l, s]) => {
      setDrafts(d.drafts ?? []);
      setLists(l.lists ?? []);
      setSenders(s.senders ?? []);
    });
  }, []);

  function toggleSender(id: string) {
    setSelectedSenders((prev) => {
      if (mode === "single") return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  function onCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) => {
          const normalized: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            normalized[k.trim().toLowerCase()] = String(v ?? "").trim();
          }
          const email = normalized.email || "";
          const customFields: Record<string, string> = {};
          for (const [k, v] of Object.entries(normalized)) {
            if (["email", "name", "company"].includes(k) || !v) continue;
            customFields[k] = v;
          }
          return {
            email,
            name: normalized.name,
            company: normalized.company,
            customFields,
          };
        });
        setCsvRecipients(rows);
      },
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        draftId: draftId || undefined,
        listId: listId || undefined,
        csvRecipients: csvRecipients.length ? csvRecipients : undefined,
        senderIds: selectedSenders,
        mode,
        delayMs: Math.round(Number(delaySec) * 1000),
        aiEnabled,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not start campaign");
      return;
    }
    router.push(`/campaigns/${data.campaign.id}`);
  }

  return (
    <div>
      <PageHeader
        title="New campaign"
        description="Pick a draft, choose recipients from a list and/or CSV, then send with one sender or rotate across several."
      />

      <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
        <Card className="space-y-3">
          <div>
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Draft</Label>
            <Select
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              required
            >
              <option value="">Select a draft…</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.subject}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Recipient list (optional)</Label>
            <Select value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">None</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.recipientCount})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Or upload CSV recipients (optional)</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsv(f);
              }}
            />
            {csvRecipients.length ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {csvRecipients.length} rows loaded from CSV
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3">
          <div>
            <Label>Send mode</Label>
            <Select
              value={mode}
              onChange={(e) => {
                const next = e.target.value as "single" | "rotate";
                setMode(next);
                setSelectedSenders((prev) =>
                  next === "single" ? prev.slice(0, 1) : prev
                );
              }}
            >
              <option value="single">Single sender</option>
              <option value="rotate">Rotate across senders</option>
            </Select>
          </div>
          <div>
            <Label>Senders</Label>
            <div className="space-y-2">
              {senders.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    name="sender"
                    checked={selectedSenders.includes(s.id)}
                    onChange={() => toggleSender(s.id)}
                  />
                  <span>
                    {s.label} · {s.fromEmail}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Delay between emails (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={delaySec}
              onChange={(e) => setDelaySec(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            AI personalize each email (requires LLM key in Settings)
          </label>
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={loading}>
          {loading ? "Starting…" : "Start campaign"}
        </Button>
      </form>
    </div>
  );
}
