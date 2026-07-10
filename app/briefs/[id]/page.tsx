import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { BookmarkForm } from "@/app/briefs/BookmarkForm";
import { FollowupAction } from "@/app/briefs/FollowupAction";
import { ItemFeedbackForm } from "@/app/briefs/ItemFeedbackForm";
import type { DailyBrief, WatchRun } from "@/lib/brief";
import { parseStructuredBrief } from "@/lib/brief";
import { formatDateTime } from "@/lib/date-format";
import { renderMarkdown } from "@/lib/markdown";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";
import {
  getActiveWatches,
  type Watch
} from "@/lib/watches";
import { watchCoversFollowup } from "@/lib/watch-helpers";

export default async function DigestPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { id } = await params;
  const pageParams = await searchParams;
  const admin = createAdminClient();
  const { data: digest } = await admin
    .from("digests")
    .select("*")
    .eq("id", id)
    .eq("user_id", profile.userId)
    .maybeSingle();

  if (!digest) {
    notFound();
  }

  const structured = parseStructuredBrief(digest.body_md);
  let rejectedUrls = new Set<string>();
  let savedUrls = new Set<string>();
  let activeWatches: Watch[] = [];

  if (structured) {
    const [
      { data: rejectedRows, error: rejectedError },
      { data: savedRows, error: savedError },
      watches
    ] = await Promise.all([
      admin
        .from("digest_items")
        .select("url")
        .eq("digest_id", digest.id)
        .eq("user_id", profile.userId)
        .not("rejected_at", "is", null),
      admin
        .from("collection_items")
        .select("url")
        .eq("user_id", profile.userId),
      getActiveWatches(profile.userId)
    ]);

    if (
      rejectedError &&
      rejectedError.code !== "PGRST204" &&
      !isMissingRejectedColumn(rejectedError)
    ) {
      throw rejectedError;
    }

    if (savedError && !isMissingCollectionTable(savedError)) {
      throw savedError;
    }

    rejectedUrls = new Set((rejectedRows ?? []).map((item) => item.url));
    savedUrls = new Set((savedRows ?? []).map((item) => item.url));
    activeWatches = watches;
  }

  return (
    <AppShell active="briefs">
        <div className="topbar">
          <div>
            <p className="eyebrow">
              {formatDateTime(digest.created_at, profile.deliveryTimezone)}
            </p>
            <h1>{structured?.brief.title ?? digest.subject}</h1>
          </div>
        </div>
        {pageParams.message ? (
          <p className={`notice ${noticeType(pageParams.type)}`}>
            {pageParams.message}
          </p>
        ) : null}
        {structured ? (
          <StructuredBrief
            brief={structured.brief}
            digestId={digest.id}
            rejectedCount={rejectedUrls.size}
            rejectedUrls={rejectedUrls}
            savedUrls={savedUrls}
            activeWatches={activeWatches}
            watchRun={structured.watchRun}
          />
        ) : (
          <article className="brief markdown">
            {renderMarkdown(normalizeLegacyBrief(digest.body_md))}
          </article>
        )}
    </AppShell>
  );
}

function StructuredBrief({
  brief,
  digestId,
  rejectedCount,
  rejectedUrls,
  savedUrls,
  activeWatches,
  watchRun
}: {
  brief: DailyBrief;
  digestId: string;
  rejectedCount: number;
  rejectedUrls: Set<string>;
  savedUrls: Set<string>;
  activeWatches: Watch[];
  watchRun: WatchRun;
}) {
  return (
    <article className="brief brief-doc">
      <section className="brief-bluf">
        <p className="eyebrow">Summary</p>
        <p>{brief.bluf}</p>
      </section>

      {watchRun.checks.length ? <WatchReport watchRun={watchRun} /> : null}

      <div className="brief-sections">
        {brief.sections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !rejectedUrls.has(item.url)
          );

          return (
            <section className="brief-section" key={section.id}>
              <div className="section-heading">
                <h2>{section.title}</h2>
                {section.summary ? <p>{section.summary}</p> : null}
              </div>

              {visibleItems.length ? (
                <div className="brief-items">
                  {visibleItems.map((item, itemIndex) => (
                    <article
                      className={`brief-item ${
                        savedUrls.has(item.url) ? "is-saved" : ""
                      }`}
                      key={`${section.id}-${item.url}-${itemIndex}`}
                    >
                      <div className="item-body">
                        <div className="item-kicker">
                          <span>{sourceTypeLabel(item.sourceType)}</span>
                          <a href={item.url} rel="noreferrer" target="_blank">
                            {item.sourceLabel}
                          </a>
                          {item.viaUrl ? (
                            <>
                              <span>via</span>
                              <a
                                href={item.viaUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {item.viaHandle || "X"}
                              </a>
                            </>
                          ) : null}
                        </div>
                        <h3>{item.title}</h3>
                        <dl>
                          <div>
                            <dt>Why</dt>
                            <dd>{item.why}</dd>
                          </div>
                          <div>
                            <dt>Takeaway</dt>
                            <dd>{item.takeaway}</dd>
                          </div>
                        </dl>
                        {item.tags.length ? (
                          <div className="item-tags">
                            {item.tags.map((tag) => (
                              <a
                                href={`/topics?tag=${encodeURIComponent(tag)}`}
                                key={tag}
                              >
                                {tag}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <BookmarkForm
                          digestId={digestId}
                          initialSaved={savedUrls.has(item.url)}
                          itemUrl={item.url}
                        />
                        <ItemFeedbackForm digestId={digestId} item={item} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No visible items in this section.</p>
              )}
            </section>
          );
        })}
      </div>

      {brief.followups.length ? (
        <section className="brief-followups">
          <h2>Suggested Follow-Ups</h2>
          <div className="followup-list">
            {brief.followups.map((followup) => {
              const startedWatch =
                activeWatches.find(
                  (watch) =>
                    watch.source_digest_id === digestId &&
                    watch.source_followup_id === followup.id
                ) ?? null;
              const coveredWatch =
                startedWatch ??
                activeWatches.find(
                  (watch) =>
                    watch.id === followup.targetWatchId &&
                    watchCoversFollowup(watch, followup)
                ) ??
                null;
              return (
                <FollowupAction
                  activeWatches={activeWatches.map((watch) => ({
                    id: watch.id,
                    title: watch.title
                  }))}
                  digestId={digestId}
                  followup={followup}
                  key={followup.id}
                  targetWatch={
                    coveredWatch
                      ? {
                          id: coveredWatch.id,
                          title: coveredWatch.title,
                          relationship: startedWatch ? "started" : "covered"
                        }
                      : null
                  }
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {rejectedCount ? (
        <section className="brief-rejected-note" aria-label="Rejected items">
          <p>
            {rejectedCount} rejected {rejectedCount === 1 ? "item" : "items"}{" "}
            hidden from this brief.
          </p>
          <a href={`/rejected?digest=${encodeURIComponent(digestId)}`}>
            Review
          </a>
        </section>
      ) : null}
    </article>
  );
}

function WatchReport({ watchRun }: { watchRun: WatchRun }) {
  const materialCount = watchRun.checks.filter(
    (check) => check.status === "material"
  ).length;

  return (
    <section className="watch-report">
      <div className="watch-report-heading">
        <h2>Focus trackers</h2>
        <p className="muted">
          {watchRun.checks.length} focus tracker
          {watchRun.checks.length === 1 ? "" : "s"} · {materialCount > 0
            ? `${materialCount} new signal${materialCount === 1 ? "" : "s"}`
            : "No new signals"}
        </p>
      </div>
      <div className="watch-report-list">
        {watchRun.checks.map((check) => (
          <article className="watch-report-row" key={check.watchId}>
            <div>
              <a className="watch-report-title" href={`/watches#watch-${check.watchId}`}>
                {check.watchTitle}
              </a>
              <p>{check.watchObjective}</p>
            </div>
            <div className="watch-report-result">
              <span className={`watch-result ${check.status}`}>
                {check.status === "material"
                  ? "New signal"
                  : check.status === "error"
                    ? "Check failed"
                    : "No material change"}
              </span>
              {check.status === "material" && check.sourceUrl ? (
                <a href={check.sourceUrl} rel="noreferrer" target="_blank">
                  {check.headline}
                </a>
              ) : check.status === "error" ? (
                <p>{check.errorMessage}</p>
              ) : (
                <p>
                  {check.evidenceSummary ||
                    "No material change since the previous check."}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function normalizeLegacyBrief(markdown: string) {
  return markdown.replace(/^#\s+Presidential Daily Brief\b/m, "# Daily Brief");
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}

function sourceTypeLabel(
  sourceType: DailyBrief["sections"][number]["items"][number]["sourceType"]
) {
  return sourceType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isMissingRejectedColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.includes("rejected_at") ||
    error.message?.includes("schema cache")
  );
}

function isMissingCollectionTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("collection_items") ||
    error.message?.includes("schema cache")
  );
}
