import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { restoreRejectedArticle } from "@/app/dashboard/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function RejectedPage({
  searchParams
}: {
  searchParams: Promise<{ digest?: string; message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;
  const admin = createAdminClient();
  let itemQuery = admin
    .from("digest_items")
    .select("*")
    .eq("user_id", profile.userId)
    .not("rejected_at", "is", null)
    .order("rejected_at", { ascending: false })
    .limit(100);

  if (params.digest) {
    itemQuery = itemQuery.eq("digest_id", params.digest);
  }

  const { data: items, error } = await itemQuery;

  if (error) {
    if (isMissingRejectedColumn(error)) {
      return (
        <AppShell active="rejected">
          <div className="topbar">
            <div>
              <p className="eyebrow">Rejected</p>
              <h1>Rejected articles</h1>
              <p className="muted">
                Rejected articles need the latest Supabase schema. Run
                `supabase/schema.sql`, then reload this page.
              </p>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }

  const feedbackByItem = await getRejectionFeedback(
    profile.userId,
    items?.map((item) => ({
      digestId: item.digest_id,
      url: item.url
    })) ?? []
  );

  return (
    <AppShell active="rejected">
      <div className="topbar">
        <div>
          <p className="eyebrow">Rejected</p>
          <h1>{params.digest ? "Rejected from this brief" : "Rejected articles"}</h1>
          <p className="muted">
            Articles marked less useful are hidden from digests and topics, then
            kept here so you can review or restore them.
          </p>
          {params.digest ? (
            <a className="text-button" href="/rejected">
              View all rejected articles
            </a>
          ) : null}
        </div>
      </div>
      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      <section className="panel">
        {items?.length ? (
          <div className="topic-item-list">
            {items.map((item) => {
              const rejectionReason = formatReason(
                feedbackByItem.get(feedbackKey(item.digest_id, item.url))
              );

              return (
                <article className="topic-item" key={item.id}>
                  <div className="item-kicker">
                    <span>{item.section_title}</span>
                    <a href={item.url} rel="noreferrer" target="_blank">
                      {item.source_label}
                    </a>
                    {item.via_url ? (
                      <>
                        <span>via</span>
                        <a href={item.via_url} rel="noreferrer" target="_blank">
                          {item.via_handle || "X"}
                        </a>
                      </>
                    ) : null}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.takeaway}</p>
                  <div className="rejected-context">
                    <p>
                      Dossier{" "}
                      <a href={`/digests/${item.digest_id}`}>
                        {item.digest_subject}
                      </a>
                    </p>
                    {rejectionReason ? (
                      <p>Rejected because {rejectionReason}</p>
                    ) : null}
                  </div>
                  <div className="item-tags">
                    {item.tags.map((tag) => (
                      <a href={`/topics?tag=${encodeURIComponent(tag)}`} key={tag}>
                        {tag}
                      </a>
                    ))}
                  </div>
                  <form action={restoreRejectedArticle}>
                    <input name="itemUrl" type="hidden" value={item.url} />
                    <input name="itemTitle" type="hidden" value={item.title} />
                    <input
                      name="sourceLabel"
                      type="hidden"
                      value={item.source_label}
                    />
                    <input name="viaHandle" type="hidden" value={item.via_handle} />
                    <input name="tags" type="hidden" value={item.tags.join(",")} />
                    <button className="text-button" type="submit">
                      Restore
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">No rejected articles.</p>
        )}
      </section>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}

async function getRejectionFeedback(
  userId: string,
  items: Array<{ digestId: string; url: string }>
) {
  const digestIds = [...new Set(items.map((item) => item.digestId))];
  const urls = [...new Set(items.map((item) => item.url))];
  const feedbackByItem = new Map<
    string,
    { reason: string; note: string } | null
  >();

  if (!digestIds.length || !urls.length) {
    return feedbackByItem;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("article_feedback")
    .select("digest_id,item_url,reason,note,created_at")
    .eq("user_id", userId)
    .eq("direction", "less")
    .in("digest_id", digestIds)
    .in("item_url", urls)
    .order("created_at", { ascending: false });

  if (error) {
    return feedbackByItem;
  }

  for (const feedback of data ?? []) {
    if (!feedback.digest_id) {
      continue;
    }

    const key = feedbackKey(feedback.digest_id, feedback.item_url);
    if (!feedbackByItem.has(key)) {
      feedbackByItem.set(key, {
        reason: feedback.reason,
        note: feedback.note
      });
    }
  }

  return feedbackByItem;
}

function feedbackKey(digestId: string, url: string) {
  return `${digestId}\n${url}`;
}

function formatReason(feedback: { reason: string; note: string } | null | undefined) {
  if (!feedback) {
    return "";
  }

  const reason = feedback.reason.trim();
  const note = feedback.note.trim();

  if (reason && note) {
    return `${reason}: ${note}`;
  }

  return reason || note;
}

function isMissingRejectedColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.includes("rejected_at") ||
    error.message?.includes("schema cache")
  );
}
