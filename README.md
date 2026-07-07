# X Analyst

A Vercel-ready Next.js app that turns a curated X list plus discovery searches
into a daily brief for any topic described in your interest profile. It uses Supabase Auth for private access,
Supabase Postgres for settings and briefs, Vercel AI SDK with a direct OpenAI API key for brief generation,
Vercel Cron for the daily production schedule, and Vercel Eve for agent tooling.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Configure Supabase email OTP auth and add your deployed URL to Auth redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Use an X API bearer token with list timeline and recent search access.
5. Use `OPENAI_API_KEY` for direct OpenAI model calls through the Vercel AI SDK.
6. Use `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` for email delivery.
7. Set `ALLOWED_EMAILS` to a comma-separated allowlist for private access.
   Non-allowlisted sign-in attempts are captured in the Supabase-backed
   waitlist.

## Local Development

```bash
pnpm install
pnpm dev
```

## Vercel

Set the same environment variables in Vercel. The daily delivery sweep is
scheduled by Eve in `agent/schedules/daily_digest.ts`. Eve turns that schedule
into a Vercel Cron Job on deploy. The schedule deterministically calls
`/api/digest/run` with `Authorization: Bearer $CRON_SECRET`, which the endpoint
requires for running eligible profiles.

Each profile stores an IANA timezone and preferred local delivery time. The Eve
schedule runs every 15 minutes; the API checks which profiles are due in their
own timezone and uses a database idempotency key to avoid sending more than one
scheduled brief per local day.

## Eve

The `agent/` directory is an Eve agent that can wrap the same brief endpoint:

```bash
pnpm eve:dev
pnpm eve:deploy
```

Eve owns the production daily schedule, and Vercel still shows it in the Cron
Jobs UI because Eve emits Vercel Cron configuration during deploy.
`/api/digest/run` collects candidates, calls the mounted Eve agent, and waits
for a structured Daily Brief generated through the staged subagent workflow.

The Eve agent includes specialized subagents for higher-quality briefing work:

- `candidate_scout` for broad candidate triage.
- `article_reader` for source-grounded extraction.
- `cluster_analyst` for duplicate and near-duplicate grouping.
- `brief_editor` for final dossier writing.

The `get_analyst_context` Eve tool retrieves the stored Markdown profile,
priority handles, discovery queries, and learning feedback so delegated work can
be judged against the reader's actual preferences.

`CRON_SECRET` is also used as the private bearer token for the Next.js API to
call the Eve HTTP channel. `APP_BASE_URL` is used as the default Eve host; set
`EVE_AGENT_HOST` only if the agent is mounted somewhere else.
