import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import type { DailyBrief } from "@/lib/brief";
import { parseStructuredBrief } from "@/lib/brief";
import { renderMarkdown } from "@/lib/markdown";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function DigestPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { id } = await params;
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

  return (
    <AppShell active="digests">
        <div className="topbar">
          <div>
            <p className="eyebrow">{new Date(digest.created_at).toDateString()}</p>
            <h1>{structured?.brief.title ?? digest.subject}</h1>
          </div>
        </div>
        {structured ? (
          <StructuredBrief brief={structured.brief} />
        ) : (
          <article className="brief markdown">
            {renderMarkdown(normalizeLegacyBrief(digest.body_md))}
          </article>
        )}
    </AppShell>
  );
}

function StructuredBrief({ brief }: { brief: DailyBrief }) {
  return (
    <article className="brief brief-doc">
      <section className="brief-bluf">
        <p className="eyebrow">BLUF</p>
        <p>{brief.bluf}</p>
      </section>

      <div className="brief-sections">
        {brief.sections.map((section) => (
          <section className="brief-section" key={section.id}>
            <div className="section-heading">
              <h2>{section.title}</h2>
              {section.summary ? <p>{section.summary}</p> : null}
            </div>

            {section.items.length ? (
              <div className="brief-items">
                {section.items.map((item) => (
                  <article className="brief-item" key={`${section.id}-${item.url}`}>
                    <div className="item-body">
                      <div className="item-kicker">
                        <span>{sourceTypeLabel(item.sourceType)}</span>
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
                            <a href={`/topics?tag=${encodeURIComponent(tag)}`} key={tag}>
                              {tag}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No items in this section.</p>
            )}
          </section>
        ))}
      </div>

      {brief.followups.length ? (
        <section className="brief-followups">
          <h2>Suggested Follow-Ups</h2>
          <ul>
            {brief.followups.map((followup) => (
              <li key={followup}>{followup}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function normalizeLegacyBrief(markdown: string) {
  return markdown.replace(/^#\s+Presidential Daily Brief\b/m, "# Daily Brief");
}

function sourceTypeLabel(
  sourceType: DailyBrief["sections"][number]["items"][number]["sourceType"]
) {
  return sourceType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
