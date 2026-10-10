"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";

export default function SettingsPage() {
  const [provider, setProvider] = useState<"openai" | "anthropic" | "">("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyMasked, setKeyMasked] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((d) => {
        setProvider((d.provider as "openai" | "anthropic") || "");
        setHasKey(Boolean(d.hasKey));
        setKeyMasked(d.keyMasked);
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: provider || null,
        apiKey: apiKey || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setApiKey("");
    setHasKey(Boolean(provider));
    setMessage("Saved");
    const refreshed = await fetch("/api/settings/llm").then((r) => r.json());
    setHasKey(Boolean(refreshed.hasKey));
    setKeyMasked(refreshed.keyMasked);
  }

  async function clearKey() {
    await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider || null, clearKey: true }),
    });
    setHasKey(false);
    setKeyMasked(null);
    setMessage("API key cleared");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Bring your own OpenAI or Anthropic key for optional AI personalization on campaigns."
      />
      <Card className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>LLM provider</Label>
            <Select
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as "openai" | "anthropic" | "")
              }
            >
              <option value="">None</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </Select>
          </div>
          <div>
            <Label>API key {hasKey ? `(saved: ${keyMasked})` : ""}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "Leave blank to keep existing key" : "sk-…"}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            {hasKey ? (
              <Button type="button" variant="secondary" onClick={clearKey}>
                Clear key
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
