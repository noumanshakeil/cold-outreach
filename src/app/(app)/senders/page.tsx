"use client";

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

type Sender = {
  id: string;
  label: string;
  fromEmail: string;
  fromName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean;
  hasPassword: boolean;
  passwordMasked: string | null;
};

const emptyForm = {
  label: "",
  fromEmail: "",
  fromName: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  smtpSecure: false,
};

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/senders");
    const data = await res.json();
    setSenders(data.senders ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const res = await fetch("/api/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        smtpPort: Number(form.smtpPort),
        fromName: form.fromName || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not save sender");
      return;
    }
    setForm(emptyForm);
    setMessage("Sender saved");
    await load();
  }

  async function testSender(id: string) {
    setMessage("");
    setError("");
    const res = await fetch("/api/senders/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "SMTP test failed");
      return;
    }
    setMessage("SMTP connection OK");
  }

  async function remove(id: string) {
    if (!confirm("Delete this sender?")) return;
    await fetch(`/api/senders/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Senders"
        description="Add SMTP accounts used to send outreach. Passwords are encrypted and never shown again."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Add SMTP sender</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
                placeholder="Work Gmail"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>From email</Label>
                <Input
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>From name</Label>
                <Input
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>SMTP host</Label>
                <Input
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  required
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>SMTP username</Label>
                <Input
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>SMTP password / app password</Label>
                <Input
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
              />
              Use TLS (secure) — usually on for port 465
            </label>
            <ErrorText>{error}</ErrorText>
            {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save sender"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Gmail OAuth senders will be available later; use SMTP + app password for now.
          </p>
        </Card>

        <div className="space-y-3">
          {senders.length === 0 ? (
            <EmptyState
              title="No senders yet"
              description="Add an SMTP account to start sending campaigns."
            />
          ) : (
            senders.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {s.fromName ? `${s.fromName} · ` : ""}
                      {s.fromEmail}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {s.smtpHost}:{s.smtpPort} · {s.smtpUser} · pass {s.passwordMasked}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => testSender(s.id)}>
                      Test
                    </Button>
                    <Button type="button" variant="danger" onClick={() => remove(s.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
