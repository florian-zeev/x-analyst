import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { CollectionNoteEditor } from "@/app/collection/CollectionNoteEditor";
import { RemoveCollectionItemButton } from "@/app/collection/RemoveCollectionItemButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function CollectionPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: items, error } = await admin
    .from("collection_items")
    .select("*")
    .eq("user_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingCollectionTable(error)) {
      return (
        <AppShell active="collection">
          <div className="topbar">
            <div>
              <p className="eyebrow">Collection</p>
              <h1>My collection</h1>
              <p className="muted">
                Collection needs the latest Supabase schema. Run
                supabase/schema.sql, then reload this page.
              </p>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }

  return (
    <AppShell active="collection">
      <div className="topbar">
        <div>
          <p className="eyebrow">Collection</p>
          <h1>My collection</h1>
          <p className="muted">
            Saved articles, posts, and source snapshots for later reuse.
          </p>
        </div>
      </div>
      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      <section className="panel">
        {items?.length ? (
          <div className="collection-list">
            {items.map((item) => (
              <article className="collection-item" key={item.id}>
                <div className="item-kicker">
                  <span>{item.source_type || item.section_title}</span>
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
                <div className="collection-item-header">
                  <h2>{item.title}</h2>
                  <RemoveCollectionItemButton itemId={item.id} title={item.title} />
                </div>
                <CollectionNoteEditor itemId={item.id} note={item.note} />
                <dl className="collection-context">
                  <div>
                    <dt>Why</dt>
                    <dd>{item.why}</dd>
                  </div>
                  <div>
                    <dt>Takeaway</dt>
                    <dd>{item.takeaway}</dd>
                  </div>
                  <div>
                    <dt>Dossier</dt>
                    <dd>
                      {item.digest_id ? (
                        <a href={`/briefs/${item.digest_id}`}>
                          {item.digest_subject}
                        </a>
                      ) : (
                        item.digest_subject || "Unknown"
                      )}
                    </dd>
                  </div>
                </dl>
                {item.content_text ? (
                  <details className="collection-snapshot">
                    <summary>Snapshot</summary>
                    <div>
                      {snapshotParagraphs(item.content_text, item.via_handle).map(
                        (paragraph, index) => (
                          <p key={`${item.id}-snapshot-${index}`}>
                            {paragraph}
                          </p>
                        )
                      )}
                    </div>
                  </details>
                ) : null}
                <div className="item-tags">
                  {item.tags.map((tag) => (
                    <a href={`/topics?tag=${encodeURIComponent(tag)}`} key={tag}>
                      {tag}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No saved items yet.</p>
        )}
      </section>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}

function isMissingCollectionTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("collection_items") ||
    error.message?.includes("schema cache")
  );
}

function snapshotParagraphs(text: string, viaHandle = "") {
  let normalized = text
    .replace(/:host(?:\(|\{)[\s\S]*$/g, "")
    .replace(/\bNew to X\?[\s\S]*$/g, "")
    .replace(/\s*\/ X Post Log in Sign up Post\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (viaHandle) {
    normalized = normalized.replace(
      new RegExp(`^[\\s\\S]*?${escapeRegExp(viaHandle)}\\s+`, "i"),
      ""
    );
  }

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .reduce<string[]>((paragraphs, sentence) => {
      const last = paragraphs[paragraphs.length - 1] ?? "";
      if (!last || last.length > 520) {
        paragraphs.push(sentence);
      } else {
        paragraphs[paragraphs.length - 1] = `${last} ${sentence}`;
      }

      return paragraphs;
    }, []);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
