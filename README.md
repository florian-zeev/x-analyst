# X Analyst

A Vercel-ready Next.js app that turns a curated X list plus discovery searches
into a daily brief for any topic described in your interest profile. It uses Supabase Auth for private access,
Supabase Postgres for settings and digests, Vercel AI SDK for brief generation,
and Vercel Eve for the scheduled agent wrapper.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Configure Supabase email OTP auth and add your deployed URL to Auth redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Use an X API bearer token with list timeline and recent search access.
5. Use `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` if you want email delivery.
6. Set `ALLOWED_EMAILS` to a comma-separated allowlist for private access.

## Local Development

```bash
pnpm install
pnpm dev
```

## Vercel

Set the same environment variables in Vercel. If `CRON_SECRET` is present,
scheduled runners can call `/api/digest/run` with
`Authorization: Bearer $CRON_SECRET`.

## Eve

The `agent/` directory is an Eve agent that wraps the same digest endpoint:

```bash
pnpm eve:dev
pnpm eve:deploy
```

Eve is kept as the durable scheduled-agent layer, while the Next.js app remains
the UI and persistence layer.
