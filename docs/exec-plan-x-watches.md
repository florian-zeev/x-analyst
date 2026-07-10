# Execution Plan: X Watches

## Objective

Turn the brief's static suggested follow-ups into a small, durable set of
user-controlled X watches. A watch monitors a focused question on X, reads
linked material only when an X post points to it, and reports only meaningful
changes in future briefs.

This is not a general web-monitoring product. It does not independently crawl
company blogs, documentation, papers, or release notes.

## Product Decisions

1. A watch describes **what to monitor**, not additional people to follow.
2. Watches use the user's existing X list, priority handles, discovery flow,
   and up to three compact, validated watch-specific X recent-search queries.
3. X Analyst does not propose, validate, or add new X handles in this version.
4. Linked pages may be read as evidence only after they are discovered through
   an X post.
5. All watches use the existing brief schedule and delivery destination. There
   is no per-watch frequency, source, or notification form in the MVP.
6. Every brief transparently reports each active watch as material, quiet, or
   failed. Only material changes receive full article treatment.
7. A user may have at most five active watches. Paused and archived watches do
   not count toward the limit.
8. If a proposed follow-up is already covered, the product says
   `Already tracked` and links to that watch. It does not mutate or broaden the
   watch automatically.
9. A watch has exactly one objective. X Analyst compiles that objective into up
   to three compact internal searches and validates them against X before
   activation. Users are not expected to maintain query syntax.
10. Existing briefs containing string follow-ups remain readable.

## User Experience

### Suggested follow-ups in a brief

Replace each plain list item with a compact action row:

> **Hosted-agent evidence chains**
>
> Track whether hosted-agent runtimes expose provenance, tool-call logs, and
> resumable state on X.
>
> `Start watch`

When an active watch already covers the recommendation:

> **Hosted-agent evidence chains**
>
> Actively tracked by Agent infrastructure.
>
> `Actively tracking` `View watch`

`Start watch` uses the generated defaults immediately and displays a bottom
confirmation with `Undo`. The user does not complete a setup form.

If five watches are already active, `Start watch` opens a shadcn dialog that
explains the limit, lists the five active watches, and offers `Manage watches`.
It does not offer an undefined automatic merge and must not silently create a
sixth active watch.

### Watches page

Add `/watches` between Collection and Learning in navigation. The first view is
a responsive list, not a wide table. Each row shows:

- watch title;
- one-sentence objective;
- active, paused, or archived state;
- last check state and time;
- last meaningful update time, or `No material update yet`.

The primary view shows active watches first. A compact overflow menu provides
Edit, Pause/Resume, and Archive. Editing exposes only title and objective;
internal searches are read-only under `Search details`. A failed query shows `Last check failed` with a concise,
non-sensitive explanation and leaves the watch active for the next run.

### Watch updates in briefs

Every brief contains a compact Watches report with one row per active watch.
Material results identify the strongest update; quiet results state how many
matching sources were assessed; failures remain visible. Material findings
also use the existing article layout, bookmark, feedback, and linked-source
behavior.

The MVP permits at most one material item per watch per brief. A source may
support more than one watch, but it is rendered once and associated with each
matching watch server-side.

The email uses the same section but contains no watch-management controls. Its
follow-up CTA links to the authenticated web brief where the watch can be
started. The email never uses a mutation URL for watches.

## Data Model

Add one user-owned table and one per-run check table to
`supabase/schema.sql`. Update the manually maintained database shapes in
`lib/supabase/types.ts`.

### `watches`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Owner, cascading from `auth.users` |
| `title` | `text` | Short user-facing name |
| `objective` | `text` | The question/development being monitored |
| `x_query` | `text` | One focused X recent-search query |
| `status` | `text` | `active`, `paused`, or `archived` |
| `source_digest_id` | `uuid null` | Brief that proposed the watch |
| `source_followup_id` | `uuid null` | Server-assigned proposal id |
| `last_checked_at` | `timestamptz null` | Most recent successful or failed check |
| `last_check_status` | `text null` | `quiet`, `material`, or `error` |
| `last_error` | `text null` | Sanitized most recent check error |
| `last_material_update_at` | `timestamptz null` | Most recent material update |
| `quiet_run_count` | `integer` | Consecutive quiet checks |
| `created_at` / `updated_at` | `timestamptz` | Audit fields |

Constraints and indexes:

- status and last-check-status check constraints;
- unique `(user_id, source_digest_id, source_followup_id)` where proposal ids
  are present, making activation idempotent;
- index `(user_id, status, updated_at desc)`;
- RLS select/insert/update/delete policies restricted to `auth.uid()`.

### `watch_checks`

Store one result per watch per persisted brief. This is the idempotency record
for quiet, material, and failed checks.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `watch_id` | `uuid` | Parent watch, cascading on delete |
| `user_id` | `uuid` | Owner for direct RLS checks |
| `digest_id` | `uuid` | Brief run that performed the check |
| `digest_item_id` | `uuid null` | Material brief item, when present |
| `status` | `text` | `quiet`, `material`, or `error` |
| `source_url` | `text null` | Canonical URL for a material result |
| `headline` | `text` | Concise material update, otherwise empty |
| `evidence_summary` | `text` | Why it was material, otherwise empty |
| `error_message` | `text` | Sanitized query error, otherwise empty |
| `created_at` | `timestamptz` | Check finalization time |

Constraints and indexes:

- unique `(watch_id, digest_id)` so retries cannot duplicate a check or
  increment `quiet_run_count` twice;
- status check constraint;
- index `(watch_id, created_at desc)`;
- owner-only RLS policies.

### `digests` addition

Add `watch_state_finalized_at timestamptz null`. This distinguishes a stored
brief whose watch checks were committed from one that needs retry repair before
email delivery.

## Database RPCs

### `activate_watch_from_followup`

Create one transactional RPC for activation. It:

1. locks the user's `analyst_profiles` row;
2. verifies that `source_digest_id` belongs to the same user;
3. returns the existing watch for an already-activated proposal;
4. counts active watches while holding the lock;
5. refuses activation with a stable `active_watch_limit` result at five;
6. inserts the watch and returns it.

The RPC must fully qualify table names, be callable only by the service role,
and validate every supplied user/digest relationship internally. Server actions
still verify the authenticated user before calling it.

### `finalize_watch_checks`

Create one transactional RPC that accepts a user id, digest id, and JSON check
payload. It:

1. verifies that the digest and every watch belong to the same user;
2. inserts `watch_checks` with conflict handling on `(watch_id, digest_id)`;
3. updates watch summary fields only for newly inserted checks;
4. resets `quiet_run_count` for material checks;
5. increments it once for quiet checks;
6. records sanitized error state without treating the watch as quiet;
7. sets `digests.watch_state_finalized_at` in the same transaction.

Calling the RPC repeatedly with the same payload must produce the same final
state.

Revoke public and authenticated execution for both RPCs and grant execution to
the service role only.

## Structured Brief Evolution

Split model-generated data from server-enriched persisted data in
`lib/brief.ts`.

### Model output

The model produces follow-up proposals without ids:

```ts
type GeneratedFollowupProposal = {
  title: string;
  description: string;
  watchTitle: string;
  watchObjective: string;
  xQuery: string;
  targetWatchId: string | null;
};
```

The model continues producing ordinary brief items without `watchIds`.

### Server enrichment

After generation, one server normalization step:

- assigns each follow-up a UUID;
- validates `targetWatchId` against the current user's active watches;
- changes an invalid or stale target to `null`;
- attaches `watchIds` to selected items from server-owned candidate provenance;
- enforces at most one selected material item per watch;
- creates a server-owned watch-run payload describing each active watch as
  `quiet`, `material`, or `error`.

Models never assign proposal ids, authorize watch targets, or provide the final
`watchIds` persisted by the application.

### Envelope version two

Persist a version-two envelope containing:

```ts
type StructuredBriefEnvelopeV2 = {
  kind: "x-analyst.daily-brief";
  version: 2;
  brief: DailyBriefV2;
  watchRun: {
    checks: Array<{
      watchId: string;
      status: "quiet" | "material" | "error";
      sourceUrl: string;
      headline: string;
      evidenceSummary: string;
      errorMessage: string;
    }>;
  };
};
```

The watch-run payload is application metadata and is not part of either model
output schema.

Keep a version-one parser for existing briefs. Normalize version-one items to
empty `watchIds` and string follow-ups to display-only legacy follow-ups without
actions. Legacy Markdown briefs remain unchanged.

## Briefing Context

Do not add relational watch data to `AnalystProfile`; that type remains the
shape of one `analyst_profiles` row.

Add a separate `BriefingContext` in `lib/watches.ts` or a focused
`lib/briefing-context.ts` containing:

- the existing `AnalystProfile`;
- learning context;
- up to five active watches;
- recent `watch_checks` for materiality comparison.

`runDigestForProfile` loads this context once. The scheduled route loads active
watches before its source check and treats an active watch as a configured
source even when the profile has no X list or general discovery query. Pass the
already loaded watches into `runDigestForProfile` to avoid a duplicate query.

Extend `agent/tools/get_analyst_context.ts` with a separate watches query rather
than pretending the rows are profile columns.

## X Collection and Source Budget

### Query execution

Extend `lib/x.ts` to accept active watches separately from profile discovery
queries. For each active watch:

- execute exactly one X recent-search query;
- request 10 posts, the existing recent-search minimum used by the app;
- do not fetch account timelines or discover handles;
- use a small in-process concurrency limit of three without adding a dependency;
- isolate watch searches with settled results so one invalid or rate-limited
  watch does not abort list and general discovery collection;
- return a sanitized per-watch error for failed searches.

The app may still treat failures of the configured X list or all general source
queries as a run-level source failure. A failed watch query becomes an `error`
watch check and is retried on the next normal brief run.

### Provenance

Add `sourceIds: string[]` and `watchIds: string[]` to collected X posts or an
equivalent server-owned candidate wrapper. When the same post appears in the
list, discovery, and multiple watches, deduplication unions these sets rather
than overwriting one `source` string.

Carry this metadata on `DigestItem`. Models receive readable watch labels in the
source pack, but the application reattaches exact watch ids from the selected
item URL using the existing tweet-provenance pattern. Subagents are not trusted
to echo ids accurately.

### Reserved candidate capacity

Interleave source classes before article fetching so later watch results cannot
be removed by the current first-80-post and first-50-candidate limits.

Reserve the initial post budget as follows:

- up to 30 unique posts from the configured X list;
- up to 25 unique posts across profile discovery queries;
- up to 5 unique posts per active watch, for at most 25 watch posts;
- fill unused capacity from any source class;
- cap the combined interleaved set at 80 posts before article fetching;
- retain the existing 50-candidate cap after article extraction.

A post matching several classes consumes one slot and retains all provenance.
Log counts and errors by source type and opaque watch id without logging private
query text.

## Materiality and Deduplication

Give both generation paths each watch's title, objective, query, and recent
checks. A watch candidate is material only if it adds a concrete development,
new evidence, changed product behavior, or a consequential contradiction.

Repetition, commentary without new facts, and a new post linking an already
covered document are quiet results. Continue using the existing global stored-
document deduplication before model ranking.

The brief editor may select at most one material item per watch. Server
normalization enforces that limit and records every successfully searched active
watch as material or quiet, regardless of whether the model follows the prompt
perfectly.

Update all of these paths:

- the Eve production request and specialist instructions;
- candidate scout, article reader, cluster analyst, and brief editor context;
- the direct `generateObject` writer used after Eve failure;
- the quiet-feed path when no ordinary candidates remain.

The direct fallback must produce the same version-two persisted shape after
server enrichment as the Eve path.

## Persistence and Retry Flow

For each brief run:

1. collect X results and server-owned watch provenance;
2. generate the model brief through Eve or direct fallback;
3. enrich the brief and create the watch-run payload;
4. encode and insert the version-two digest;
5. persist `digest_items` and retain their returned ids;
6. attach material `digest_item_id` values to the check payload;
7. call `finalize_watch_checks`;
8. send the styled email only after finalization succeeds.

Change `storeDigestItemsForBrief` to return persisted item ids keyed by the
same normalized URL used for provenance. Its existing idempotent upsert behavior
must be preserved.

If finalization fails, do not send email. A scheduled retry that finds an
existing unsent digest with a null `watch_state_finalized_at` reconstructs the
payload from the stored version-two envelope and `digest_items`, calls the same
RPC, and only then sends the stored email. Version-one and legacy briefs contain
no watch-run payload and require no watch finalization.

Email failure after successful finalization does not roll back watch state; the
existing unsent-email retry path remains responsible for delivery.

## Follow-up Proposal Rules

The brief editor receives active watch ids, titles, objectives, and queries.
For each proposed follow-up it must:

1. identify an existing target when the objective is already substantially
   covered;
2. otherwise propose one narrowly scoped new watch;
3. never propose a handle, account timeline, general web source, or independent
   web crawl;
4. generate no more than three proposals;
5. avoid proposing a new watch when five are already active.

Existing targets render as `Already tracked`; they are not extended. The server
validates every target id against the authenticated user's active watches.

Before activation, normalize the generated X query by trimming whitespace,
removing line breaks and control characters, enforcing a conservative length
limit, and rejecting an empty query. Append `-is:retweet lang:en` only at fetch
time.

Do not claim to fully validate X operator syntax locally. If X rejects a stored
query during collection, record an error check, show the failure on the Watches
page, and retry on the next run after the user edits it.

## Server Actions and Components

Add:

- `lib/watches.ts`: owner-scoped reads, source budgeting helpers, activation,
  pause/resume, archive, undo, and check finalization payloads;
- `lib/briefing-context.ts`: profile, learning, active-watch, and recent-check
  loading;
- `app/watches/page.tsx`: responsive watch management page;
- `app/watches/WatchActions.tsx`: pending states and shadcn dialogs;
- `app/briefs/FollowupAction.tsx`: Start/Already tracked behavior with bottom
  confirmation and Undo;
- `app/watches/actions.ts`: focused server actions rather than further expanding
  `app/dashboard/actions.ts`.

Update `app/AppShell.tsx` in both places required by its current design: add the
navigation item and add `watches` to the typed `active` union.

Every mutation verifies the authenticated user and scopes writes by `user_id`.
Use `useActionState` for pending/error/success behavior so activating a watch
does not navigate away or jump the reader to the top.

Undo archives the newly created watch rather than deleting its audit history.
It is offered only immediately after successful activation.

## Email Integration

Extend `BriefHtmlOptions` in `lib/brief.ts` with an absolute authenticated brief
URL or a follow-up URL builder. Build it only after the digest id exists, using
`APP_BASE_URL` and a brief anchor containing the server-assigned proposal id.

Email rendering shows the recommendation and an `Open brief` link. Starting a
watch still requires the authenticated app action. Stored-email retries rebuild
the same links from the stored digest id.

## Styling and Accessibility

Follow the established visual system:

- no bordered buttons;
- black primary and light-gray secondary actions;
- no card nested inside the brief item;
- follow-up rows use spacing and type hierarchy, not horizontal rules;
- management controls are visually subordinate to recommendation text;
- mobile actions wrap without horizontal scrolling;
- active, paused, archived, and failed labels look like status markers, not
  buttons;
- pending actions expose `aria-busy` and disable duplicate submission;
- confirmations use `role="status"`; errors use an appropriate alert role;
- every overflow or icon-only action has an accessible name and tooltip.

## Migration and Rollout

1. Make all SQL additions idempotent with `create table if not exists`, guarded
   `alter table`, dropped/recreated policies, and `notify pgrst, 'reload schema'`.
2. Add the two RPCs and their explicit grants in the same schema change.
3. Deploy the database migration before application code that writes watches.
4. Keep version-one structured briefs and legacy Markdown briefs readable.
5. Do not backfill historical follow-ups into watches. Watches begin only after
   explicit user activation.
6. If watch tables or RPCs are missing, brief rendering still works and Start
   watch reports that the latest Supabase schema is required.
7. Deploy application code with watch collection enabled immediately; the five-
   watch and result-budget limits bound initial production load.
8. Deploy the updated Eve agent after the application and schema are live.

Rollback application code may continue reading version-two envelopes through
the compatibility parser added before activation is exposed. Do not roll back
the additive tables or columns during an application rollback.

## Delivery Sequence

### Phase 1: Schema, contracts, and pure helpers

- Add tables, digest column, constraints, indexes, RLS, RPCs, and manual
  Supabase TypeScript shapes.
- Add generation schemas, version-two persisted schemas, and version-one
  parsing.
- Add query normalization, source interleaving, provenance union, and check-
  payload helpers as dependency-free functions.

### Phase 2: Activation and management UI

- Implement idempotent Start watch and archive-based Undo.
- Render Already tracked/View watch for covered proposals.
- Add Watches navigation and responsive management page.
- Add pause/resume, edit, archive, empty, loading, limit, and error states.

### Phase 3: X collection and briefing context

- Load the separate briefing context once per run.
- Make active watches count as configured sources.
- Fetch bounded watch-specific X searches with partial-failure isolation.
- Interleave source budgets and preserve watch provenance server-side.

### Phase 4: Both generation paths

- Update the Eve request and every specialist instruction.
- Update the direct fallback writer and quiet-feed path.
- Add server enrichment, proposal ids, target validation, and one-update-per-
  watch enforcement.

### Phase 5: Persistence, retry, web, and email

- Return persisted digest item ids.
- Finalize idempotent watch checks before email.
- Repair unfinalized stored briefs on scheduled retry.
- Render Watch Updates and actionable follow-ups in web briefs.
- Render Watch Updates and authenticated Open brief links in email.

### Phase 6: Hardening and production observation

- Add structured logs for watch counts, per-source result counts, material,
  quiet, and error checks, activation conflicts, finalization repair, and limit
  refusals.
- Confirm that no logs contain query text, source excerpts, or unmasked email.
- Review production X request volume and Vercel duration before changing limits.

## Test Strategy

The repository currently has no declared test runner. Add a `test` script using
Node 24's built-in test runner and type stripping, without adding a production
dependency. Keep pure modules under test free of Next.js aliases so tests can
use relative imports.

Automate:

- version-one and version-two schema parsing;
- server assignment of proposal ids and rejection of stale target ids;
- query normalization and length rejection;
- provenance union for a post found by multiple sources and watches;
- reserved source interleaving and total caps;
- one-material-item-per-watch enforcement;
- finalization payload reconstruction from a stored envelope;
- legacy brief rendering;
- mocked partial X-query failure without aborting other sources;
- both Eve-success normalization and direct-fallback normalization.

Database concurrency and RLS behavior cannot be credibly covered by the current
repository alone. Add a non-production integration verification script that:

- requires an explicit test Supabase URL and secret;
- creates isolated fixture users and data;
- runs concurrent activation calls and proves only five become active;
- repeats finalization and proves one check and one quiet increment;
- verifies cross-user ids are rejected by both RPCs;
- cleans up its fixtures in a `finally` block;
- refuses to run when the configured URL equals `APP_BASE_URL` production
  metadata or when an explicit `ALLOW_TEST_DB_MUTATION=1` flag is absent.

RLS policy verification with authenticated test sessions remains a manual
release check unless local Supabase infrastructure is added separately.

## Minimum Validation

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- apply `supabase/schema.sql` twice to the non-production project;
- run the guarded Supabase integration verification;
- manually generate a brief through Eve success and forced direct fallback;
- manually retry an unfinalized existing unsent brief;
- confirm one failed watch query does not abort the brief;
- inspect styled email in narrow mobile and desktop clients;
- verify Watches and follow-up actions at 375px without horizontal scrolling;
- verify keyboard operation, focus return, pending states, errors, and Undo.

## Manual Acceptance Checks

1. A new structured follow-up starts a watch without navigation or scroll jump.
2. Repeating Start watch returns the existing watch.
3. A covered proposal says Already tracked and does not alter the watch.
4. A sixth active watch cannot be created.
5. Paused and archived watches produce no X searches.
6. A watch can be the only configured source for a scheduled brief.
7. Unknown X accounts may supply posts but never become configured sources.
8. A linked article is read only when reached from an X post.
9. A repeated or non-material result records one quiet check and creates no
   Watch Updates section.
10. A material result appears once in web and email and records one material
    check, even when it matches several searches.
11. A failed watch query records an error while other sources still complete.
12. Retrying an unfinalized brief repairs checks before sending email.
13. Old string-follow-up briefs still render without action buttons.
14. The Watches page and follow-up actions fit a 375px viewport.

## Explicit Non-Goals

- recommending or automatically adding X handles;
- monitoring arbitrary websites independently of X;
- automatic merging or broadening of existing watches;
- multiple objectives or queries within one watch;
- immediate alerts outside the daily brief;
- per-watch schedules, timezones, email destinations, or source selectors;
- follower-count or account-authority scoring;
- automatic watch creation without a user action;
- semantic vector infrastructure solely for watch matching;
- one-off research tasks in the initial release.

## Completion Criteria

The feature is complete when a user can activate a bounded X watch from a
structured follow-up, see when a recommendation is already tracked, manage the
watch at `/watches`, and receive only material, deduplicated X-derived updates
in later web and email briefs. Watch checks must remain correct across retries,
partial X failures, Eve fallback, and email failure, while legacy briefs and the
existing profile-driven briefing workflow continue to work.
