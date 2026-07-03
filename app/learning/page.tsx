import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
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
          <div className="table-wrap">
            <table className="digests-table">
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Item</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((item) => (
                  <tr key={item.id}>
                    <td>{item.direction}</td>
                    <td>
                      <a className="table-title" href={item.item_url}>
                        {item.item_title}
                      </a>
                      <p className="muted">
                        {item.source_label}
                        {item.via_handle ? ` via ${item.via_handle}` : ""}
                      </p>
                    </td>
                    <td>
                      {item.reason || "none"}
                      {item.note ? <p className="muted">{item.note}</p> : null}
                    </td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
