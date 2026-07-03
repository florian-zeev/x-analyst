import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1 className="brand">X Analyst</h1>
        <p className="muted">
          A private daily brief for AI Twitter, linked articles, tools,
          products, and companies.
        </p>
      </aside>
      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Briefing room</p>
            <h1>Stay current without living in the timeline.</h1>
            <p className="muted">
              Connect Supabase auth, add your X list and interest profile, then
              run the daily digest on Vercel.
            </p>
          </div>
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
        {!hasSupabasePublicEnv() ? (
          <p className="notice">
            Supabase is not configured yet. Copy `.env.example` to `.env.local`
            and fill in the public Supabase URL and publishable key before
            signing in.
          </p>
        ) : null}
        <div className="grid">
          <section className="panel">
            <h2>Sources</h2>
            <p className="muted">
              Pulls recent posts from an X list and optional discovery searches,
              prioritizing links to articles and product announcements.
            </p>
          </section>
          <section className="panel">
            <h2>Judgment</h2>
            <p className="muted">
              Ranks items against your Markdown interest profile with the
              Vercel AI SDK, then composes a concise daily brief.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
