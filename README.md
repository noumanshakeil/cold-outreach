# Cold Outreach

Multi-tenant dashboard to configure SMTP sender accounts, build recipient lists (Enter-to-add + CSV), compose HTML/plain drafts with merge tags, and send campaigns with single-sender or rotating senders. Optional BYOK AI personalization (OpenAI / Anthropic).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Postgres + Prisma
- Auth.js (credentials)
- Nodemailer (SMTP)
- TipTap editor

## Quick start

1. Start Postgres (Docker):

```bash
docker compose up -d
```

2. Copy env and fill secrets:

```bash
cp .env.example .env
```

Generate values:

```bash
# AUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (64 hex chars)
openssl rand -hex 32
```

3. Install, migrate, run:

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, then:

1. **Senders** — add SMTP credentials (test connection)
2. **Lists** — type email + Enter, or import CSV
3. **Drafts** — write HTML + plain fallback with `{{name}}`, `{{company}}`, `{{custom.field}}`
4. **Settings** — optional LLM API key for AI rewrite
5. **New campaign** — pick draft, list/CSV, single or rotate senders, start

## Notes

- SMTP passwords and LLM keys are encrypted at rest with `ENCRYPTION_KEY`.
- Campaign sending uses an in-process job runner with per-campaign delay (default 30s). Prefer a Node host (Railway/Render/Fly), not serverless-only.
- Gmail OAuth sender type is stubbed in the schema for a later release.
- CSV import capped at 5000 rows.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx prisma studio` | Browse database |
