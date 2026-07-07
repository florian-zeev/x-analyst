import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { formatDateTime } from "@/lib/date-format";
import { getLearningContext } from "@/lib/learning";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function LearningPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const learning = await getLearningContext(profile.userId);
  const admin = createAdminClient();
  const { data: feedback } = await admin
    .from("article_feedback")
    .select("*")
    .eq("user_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <AppShell active="learning">
      <div className="topbar">
        <div>
          <p className="eyebrow">Learning</p>
          <h1>Preference signals</h1>
          <p className="muted">
            Review the explicit more/less feedback used to steer future briefs.
          </p>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Current learning summary</h2>
          <div className="learning-summary">
            <div className="learning-counts">
              <div>
                <span>{learning.moreCount}</span>
                <p>More-like-this</p>
              </div>
              <div>
                <span>{learning.lessCount}</span>
                <p>Less-like-this</p>
              </div>
            </div>
            <LearningGroup title="Prefer labels" values={learning.moreTags} />
            <LearningGroup title="Down-rank labels" values={learning.lessTags} />
            <LearningGroup title="Prefer sources" values={learning.moreSources} />
            <LearningGroup title="Down-rank sources" values={learning.lessSources} />
          </div>
        </section>
        <section className="panel">
          <h2>Strongest labels</h2>
          <p className="muted">
            More: {learning.moreTags.join(", ") || "none yet"}
          </p>
          <p className="muted">
            Less: {learning.lessTags.join(", ") || "none yet"}
          </p>
        </section>
      </div>

      <section className="panel learning-list">
        <h2>Recent feedback</h2>
        {feedback?.length ? (
          <div className="feedback-list">
            {feedback.map((item) => (
              <article className="feedback-row" key={item.id}>
                <p className="feedback-direction">{item.direction}</p>
                <div>
                  <a className="table-title" href={item.item_url}>
                    {item.item_title}
                  </a>
                  <p className="muted">
                    {item.source_label}
                    {item.via_handle ? ` via ${item.via_handle}` : ""}
                  </p>
                </div>
                <div>
                  <p>{item.reason || "none"}</p>
                  {item.note ? <p className="muted">{item.note}</p> : null}
                </div>
                <p className="muted">
                  {formatDateTime(item.created_at, profile.deliveryTimezone)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No feedback recorded yet.</p>
        )}
      </section>
    </AppShell>
  );
}

function LearningGroup({
  title,
  values
}: {
  title: string;
  values: string[];
}) {
  return (
    <div className="learning-group">
      <h3>{title}</h3>
      {values.length ? (
        <div className="learning-pill-list">
          {values.map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      ) : (
        <p className="muted">None yet</p>
      )}
    </div>
  );
}
