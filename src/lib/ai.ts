import type { MergeFields } from "@/lib/merge";

export type AiRewriteResult = {
  subject: string;
  html: string;
  text: string;
};

async function callOpenAI(
  apiKey: string,
  system: string,
  user: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

async function callAnthropic(
  apiKey: string,
  system: string,
  user: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Empty Anthropic response");
  return text;
}

function extractJson(raw: string): AiRewriteResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in AI response");
  const parsed = JSON.parse(match[0]) as AiRewriteResult;
  if (!parsed.subject || !parsed.html || !parsed.text) {
    throw new Error("AI JSON missing fields");
  }
  return parsed;
}

export async function rewriteEmailForRecipient(input: {
  provider: string;
  apiKey: string;
  subject: string;
  html: string;
  text: string;
  fields: MergeFields;
}): Promise<AiRewriteResult> {
  const system =
    "You lightly personalize cold outreach emails. Keep the same meaning and intent. Do not invent false facts. Return strict JSON with keys subject, html, text.";
  const user = JSON.stringify({
    recipient: {
      email: input.fields.email,
      name: input.fields.name,
      company: input.fields.company,
      customFields: input.fields.customFields,
    },
    template: {
      subject: input.subject,
      html: input.html,
      text: input.text,
    },
    instruction:
      "Rewrite subject/html/text slightly for this recipient. Keep merge personalization already applied. Preserve links and structure in HTML.",
  });

  const raw =
    input.provider === "anthropic"
      ? await callAnthropic(input.apiKey, system, user)
      : await callOpenAI(input.apiKey, system, user);

  return extractJson(raw);
}
