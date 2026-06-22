import { redirect } from "next/navigation";
import { saveProfile, signOut } from "@/app/dashboard/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function DashboardPage() {
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
    .limit(5);

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1 className="brand">X Analyst</h1>
        <nav className="nav">
          <a href="#profile">Profile</a>
          <a href="#digests">Digests</a>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </aside>
      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Control plane</p>
            <h1>Daily AI briefing setup</h1>
            <p className="muted">
              Signed in as {profile.email}. Vercel Cron runs the brief at 06:00
              UTC by default.
            </p>
          </div>
          <form action="/api/digest/run" method="get">
            <button className="button secondary" type="submit">
              Run now
            </button>
          </form>
        </div>

        <div className="grid" id="profile">
          <form className="panel full form" action={saveProfile}>
            <h2>Sources and interest profile</h2>
            <label>
              X list ID
              <input
                name="xListId"
                defaultValue={profile.xListId ?? ""}
                placeholder="Example: 1234567890"
              />
            </label>
            <label>
              Discovery queries, one per line
              <textarea
                name="discoveryQueries"
                defaultValue={profile.discoveryQueries.join("\n")}
              />
            </label>
            <label>
              Digest recipient email
              <input
                name="digestEmail"
                type="email"
                defaultValue={profile.digestEmail ?? ""}
              />
            </label>
            <label>
              Markdown interest profile
              <textarea
                name="interestProfileMd"
                defaultValue={profile.interestProfileMd}
                style={{ minHeight: 320 }}
              />
            </label>
            <div className="actions">
              <button className="button" type="submit">
                Save
              </button>
              <a className="button ghost" href="/api/digest/run">
                Generate brief
              </a>
            </div>
          </form>

          <section className="panel full" id="digests">
            <h2>Recent briefs</h2>
            {digests?.length ? (
              <div className="list">
                {digests.map((digest) => (
                  <article className="item" key={digest.id}>
                    <h3>{digest.subject}</h3>
                    <p className="muted">
                      {new Date(digest.created_at).toLocaleString()} ·{" "}
                      {digest.item_count} candidate items
                      {digest.sent_at ? " · emailed" : ""}
                    </p>
                    <a className="button ghost" href={`/digests/${digest.id}`}>
                      Read brief
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No briefs generated yet.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
