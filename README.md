# X Analyst

A Vercel-ready Next.js app that turns a curated X list plus discovery searches
into a daily brief for any topic described in your interest profile. It uses Supabase Auth for private access,
Supabase Postgres for settings and digests, Vercel AI SDK for brief generation,
Vercel Cron for the daily production schedule, and Vercel Eve for agent tooling.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Configure Supabase email OTP auth and add your deployed URL to Auth redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Use an X API bearer token with list timeline and recent search access.
5. Use `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` for email delivery.
6. Set `ALLOWED_EMAILS` to a comma-separated allowlist for private access.
   Non-allowlisted sign-in attempts are captured in the Supabase-backed
   waitlist.

## Local Development

```bash
pnpm install
pnpm dev
```

## Vercel

Set the same environment variables in Vercel. The daily digest is scheduled in
`vercel.json` as a Vercel Cron Job at `0 6 * * *` UTC. If `CRON_SECRET` is
present, Vercel automatically calls `/api/digest/run` with
`Authorization: Bearer $CRON_SECRET`, which the endpoint requires for running
all profiles.

## Eve

The `agent/` directory is an Eve agent that can wrap the same digest endpoint:

```bash
pnpm eve:dev
pnpm eve:deploy
```

Vercel Cron owns the production daily schedule so it appears in the Vercel Cron
Jobs UI. Eve remains available for agent workflows around the same digest runner.
