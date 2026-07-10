import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { WatchActions } from "@/app/watches/WatchActions";
import { formatDateTime } from "@/lib/date-format";
import { getCurrentUserProfile } from "@/lib/profile";
import { ACTIVE_WATCH_LIMIT, getWatches, type Watch } from "@/lib/watches";
import { watchQueries } from "@/lib/watch-helpers";

export default async function WatchesPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login");
  }

  const watches = await getWatches(profile.userId);
  const activeCount = watches.filter((watch) => watch.status === "active").length;
  const currentWatches = sortWatches(
    watches.filter((watch) => watch.status !== "archived")
  );
  const archivedWatches = sortWatches(
    watches.filter((watch) => watch.status === "archived")
  );

  return (
    <AppShell active="watches">
      <div className="topbar">
        <div>
          <p className="eyebrow">Focus trackers</p>
          <h1>Focused questions</h1>
          <p className="muted">
            Your profile drives broad discovery. Focus trackers recheck a small
            number of specific questions and report them separately.
          </p>
        </div>
        <p className="watch-count">
          {activeCount} / {ACTIVE_WATCH_LIMIT} active
        </p>
      </div>

      {watches.length ? (
        <div className="watch-groups">
          {currentWatches.length ? (
            <WatchList
              timeZone={profile.deliveryTimezone}
              watches={currentWatches}
            />
          ) : null}
          {archivedWatches.length ? (
            <section className="archived-watches">
              <div className="archived-watches-heading">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Archived</h2>
                </div>
              </div>
              <WatchList
                timeZone={profile.deliveryTimezone}
                watches={archivedWatches}
              />
            </section>
          ) : null}
        </div>
      ) : (
        <section className="empty-state">
          <h2>No focus trackers yet</h2>
          <p>
            Start one from a suggested follow-up at the end of a new brief.
          </p>
          <a className="shadcn-button shadcn-button-outline" href="/briefs">
            View briefs
          </a>
        </section>
      )}
    </AppShell>
  );
}

function WatchList({ watches, timeZone }: { watches: Watch[]; timeZone: string }) {
  return (
    <div className="watch-list">
      {watches.map((watch) => (
        <article
          className={`watch-row ${watch.status}`}
          id={`watch-${watch.id}`}
          key={watch.id}
        >
          <div className="watch-row-heading">
            <div>
              {watch.status !== "archived" ? (
                <span className={`watch-status ${watch.status}`}>
                  {watch.status}
                </span>
              ) : null}
              <h2>{watch.title}</h2>
            </div>
            <WatchActions watch={watch} />
          </div>
          <p className="watch-objective">{watch.objective}</p>
          <details className="watch-search-details">
            <summary>Search terms</summary>
            <p className="watch-search-help">
              All terms must appear in a post. Put words in quotes to keep them
              together, for example <code>&quot;agent memory&quot;</code>. Use{" "}
              <code>OR</code> for alternatives.
            </p>
            <ul>
              {watchQueries(watch.x_query).map((query) => (
                <li key={query}>
                  <code>{query}</code>
                </li>
              ))}
            </ul>
          </details>
          <dl className="watch-meta">
            <div>
              <dt>Last check</dt>
              <dd>{lastCheckLabel(watch, timeZone)}</dd>
            </div>
            <div>
              <dt>Last material update</dt>
              <dd>
                {watch.last_material_update_at
                  ? formatDateTime(watch.last_material_update_at, timeZone)
                  : "No material update yet"}
              </dd>
            </div>
          </dl>
          {watch.last_check_status === "error" && watch.last_error ? (
            <p className="watch-error" role="alert">
              Last check failed: {watch.last_error}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function sortWatches(watches: Watch[]) {
  const order = { active: 0, paused: 1, archived: 2 };
  return [...watches].sort(
    (left, right) =>
      order[left.status] - order[right.status] ||
      right.updated_at.localeCompare(left.updated_at)
  );
}

function lastCheckLabel(watch: Watch, timezone: string) {
  if (!watch.last_checked_at) {
    return "Not checked yet";
  }

  const state =
    watch.last_check_status === "material"
      ? "Material update"
      : watch.last_check_status === "error"
        ? "Failed"
        : "Quiet";
  return `${state} · ${formatDateTime(watch.last_checked_at, timezone)}`;
}
