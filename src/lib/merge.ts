export type MergeFields = {
  email: string;
  name?: string | null;
  company?: string | null;
  customFields?: Record<string, unknown> | null;
};

export function applyMergeTags(template: string, fields: MergeFields): string {
  const custom =
    fields.customFields && typeof fields.customFields === "object"
      ? (fields.customFields as Record<string, unknown>)
      : {};

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (key === "email") return fields.email ?? "";
    if (key === "name") return fields.name ?? "";
    if (key === "company") return fields.company ?? "";
    if (key.startsWith("custom.")) {
      const prop = key.slice("custom.".length);
      const val = custom[prop];
      return val == null ? "" : String(val);
    }
    const val = custom[key];
    return val == null ? "" : String(val);
  });
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
