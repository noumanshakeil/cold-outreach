"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RichEditor } from "@/components/rich-editor";
import { htmlToPlainText } from "@/lib/merge";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Textarea,
} from "@/components/ui";

const TAGS = ["{{email}}", "{{name}}", "{{company}}", "{{custom.role}}"];

export function DraftEditor({
  draftId,
  initial,
}: {
  draftId?: string;
  initial?: {
    name: string;
    subject: string;
    htmlBody: string;
    textBody: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [htmlBody, setHtmlBody] = useState(
    initial?.htmlBody ?? "<p>Hi {{name}},</p><p></p>"
  );
  const [textBody, setTextBody] = useState(initial?.textBody ?? "");
  const [autoPlain, setAutoPlain] = useState(!initial?.textBody);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (autoPlain) setTextBody(htmlToPlainText(htmlBody));
  }, [htmlBody, autoPlain]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = { name, subject, htmlBody, textBody };
    const res = await fetch(draftId ? `/api/drafts/${draftId}` : "/api/drafts", {
      method: draftId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not save draft");
      return;
    }
    router.push(draftId ? `/drafts/${draftId}` : `/drafts/${data.draft.id}`);
    router.refresh();
  }

  async function onDelete() {
    if (!draftId || !confirm("Delete this draft?")) return;
    await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
    router.push("/drafts");
  }

  return (
    <div>
      <PageHeader
        title={draftId ? "Edit draft" : "New draft"}
        description="Use merge tags in the subject or body. Plain text is kept as a fallback for clients that prefer it."
        action={
          draftId ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          ) : null
        }
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-3">
          <div>
            <Label>Draft name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Quick idea for {{company}}"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]"
                onClick={() => setSubject((s) => `${s}${t}`)}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <Label>HTML body</Label>
            <RichEditor value={htmlBody} onChange={setHtmlBody} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Plain text fallback</Label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={autoPlain}
                  onChange={(e) => setAutoPlain(e.target.checked)}
                />
                Auto from HTML
              </label>
            </div>
            <Textarea
              rows={6}
              value={textBody}
              onChange={(e) => {
                setAutoPlain(false);
                setTextBody(e.target.value);
              }}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save draft"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
