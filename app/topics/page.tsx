import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

const pageSize = 25;

type TopicItem = {
  id: string;
  digestId: string;
  digestSubject: string;
  createdAt: string;
  sectionTitle: string;
  title: string;
  sourceLabel: string;
  url: string;
  viaHandle: string;
  viaUrl: string;
  sourceType: string;
  why: string;
  takeaway: string;
  tags: string[];
};

export default async function TopicsPage({
  searchParams
}: {
  searchParams: Promise<{ tag?: string | string[]; page?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const params = await searchParams;
  const selectedTags = normalizeTags(params.tag);
  const page = normalizePage(params.page);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let itemQuery = admin
    .from("digest_items")
    .select("*", { count: "exact" })
    .eq("user_id", profile.userId)
    .order("digest_created_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (selectedTags.length) {
    itemQuery = itemQuery.contains("tags", selectedTags);
  }

  const [{ data: itemRows, count, error: itemError }, { data: tagRows }] =
    await Promise.all([
      itemQuery,
      admin.rpc("topic_filter_tags", {
        profile_user_id: profile.userId,
        selected_tags: selectedTags
      })
    ]);

  if (itemError) {
    throw itemError;
  }

  const items: TopicItem[] = (itemRows ?? []).map((item) => ({
    id: item.id,
    digestId: item.digest_id,
    digestSubject: item.digest_subject,
    createdAt: item.digest_created_at,
    sectionTitle: item.section_title,
    title: item.title,
    sourceLabel: item.source_label,
    url: item.url,
    viaHandle: item.via_handle,
    viaUrl: item.via_url,
    sourceType: item.source_type,
    why: item.why,
    takeaway: item.takeaway,
    tags: item.tags
  }));
  const availableTags = (tagRows ?? [])
    .map((row) => row.tag)
    .filter((tag) => !selectedTags.includes(tag));
  const filterTags = [...selectedTags, ...availableTags];
  const totalItems = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <AppShell active="topics">
      <div className="topbar">
        <div>
          <p className="eyebrow">Topics</p>
          <h1>Topic explorer</h1>
          <p className="muted">
            Combine labels to review brief items by theme across generated
            digests.
          </p>
        </div>
      </div>

      <div className="topics-layout">
        <aside className="topic-filter-panel">
          <h2>Labels</h2>
          {selectedTags.length ? (
            <a className="text-button" href="/topics">
              Clear filters
            </a>
          ) : null}
          <div className="topic-filter-list">
            {filterTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              const href = selected
                ? topicHref(selectedTags.filter((item) => item !== tag))
                : topicHref([...selectedTags, tag]);

              return (
                <a
                  aria-current={selected ? "true" : undefined}
                  href={href}
                  key={tag}
                >
                  {selected ? `${tag} ×` : tag}
                </a>
              );
            })}
          </div>
        </aside>

        <section className="topic-results">
          <div className="section-heading">
            <h2>
              {selectedTags.length
                ? selectedTags.join(" + ")
                : "All labeled items"}
            </h2>
            <p>
              {totalItems} items · page {Math.min(page, totalPages)} of{" "}
              {totalPages}
            </p>
          </div>

          <div className="topic-item-list">
            {items.map((item) => (
              <article
                className="topic-item"
                key={item.id}
              >
                <div className="item-kicker">
                  <span>{item.sectionTitle}</span>
                  <a href={item.url} rel="noreferrer" target="_blank">
                    {item.sourceLabel}
                  </a>
                  {item.viaUrl ? (
                    <>
                      <span>via</span>
                      <a href={item.viaUrl} rel="noreferrer" target="_blank">
                        {item.viaHandle || "X"}
                      </a>
                    </>
                  ) : null}
                </div>
                <h3>{item.title}</h3>
                <p>{item.takeaway}</p>
                <div className="item-tags">
                  {item.tags.map((tag) => (
                    <a href={topicHref([tag])} key={tag}>
                      {tag}
                    </a>
                  ))}
                </div>
                <a className="text-button" href={`/digests/${item.digestId}`}>
                  {new Date(item.createdAt).toLocaleDateString()} brief
                </a>
              </article>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Topic results pages">
              {page > 1 ? (
                <a className="button ghost" href={topicHref(selectedTags, page - 1)}>
                  Previous
                </a>
              ) : (
                <span />
              )}
              <span>
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>
              {page < totalPages ? (
                <a className="button ghost" href={topicHref(selectedTags, page + 1)}>
                  Next
                </a>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function normalizeTags(tag: string | string[] | undefined) {
  return (Array.isArray(tag) ? tag : tag ? [tag] : [])
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePage(page: string | undefined) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function topicHref(tags: string[], page = 1) {
  const params = new URLSearchParams();
  for (const tag of tags) {
    params.append("tag", tag);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/topics?${query}` : "/topics";
}
