import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { parseStructuredBrief } from "@/lib/brief";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

type TopicItem = {
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
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: digests } = await admin
    .from("digests")
    .select("*")
    .eq("user_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (digests ?? []).flatMap((digest) => {
    const structured = parseStructuredBrief(digest.body_md);
    if (!structured) {
      return [];
    }

    return structured.brief.sections.flatMap((section) =>
      section.items.map(
        (item): TopicItem => ({
          digestId: digest.id,
          digestSubject: digest.subject,
          createdAt: digest.created_at,
          sectionTitle: section.title,
          title: item.title,
          sourceLabel: item.sourceLabel,
          url: item.url,
          viaHandle: item.viaHandle,
          viaUrl: item.viaUrl,
          sourceType: item.sourceType,
          why: item.why,
          takeaway: item.takeaway,
          tags: item.tags
        })
      )
    );
  });

  const params = await searchParams;
  const selectedTags = normalizeTags(params.tag);
  const allTags = [...new Set(items.flatMap((item) => item.tags))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredItems = selectedTags.length
    ? items.filter((item) => selectedTags.every((tag) => item.tags.includes(tag)))
    : items;
  const availableTags = selectedTags.length
    ? [
        ...new Set(
          filteredItems
            .flatMap((item) => item.tags)
            .filter((tag) => !selectedTags.includes(tag))
        )
      ].sort((a, b) => a.localeCompare(b))
    : allTags;
  const filterTags = [...selectedTags, ...availableTags];

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
            <p>{filteredItems.length} items</p>
          </div>

          <div className="topic-item-list">
            {filteredItems.map((item) => (
              <article
                className="topic-item"
                key={`${item.digestId}-${item.url}-${item.title}`}
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

function topicHref(tags: string[]) {
  const params = new URLSearchParams();
  for (const tag of tags) {
    params.append("tag", tag);
  }

  const query = params.toString();
  return query ? `/topics?${query}` : "/topics";
}
