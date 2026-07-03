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
          A private daily brief for curated X sources, linked articles, and
          the topics you care about.
        </p>
        <p className="sidebar-credit">
          (c) 2026{" "}
          <a href="https://www.fwolf.io" rel="noreferrer" target="_blank">
            Florian Wolf
          </a>
        </p>
      </aside>
      <section className="main landing-main">
        <div className="landing-hero">
          <div>
            <p className="eyebrow">Briefing room</p>
            <h1>X intelligence, edited down to a daily brief.</h1>
            <p>
              X Analyst reads your chosen sources, follows linked articles, and
              ranks what matters against your own written interest profile.
            </p>
          </div>
          <Link className="button landing-sign-in" href="/login">
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
              Curated X lists, priority handles, discovery searches, native
              posts, and links worth opening.
            </p>
          </section>
          <section className="panel">
            <h2>Profile</h2>
            <p className="muted">
              A Markdown brief of what you care about, plus feedback that tunes
              future selection.
            </p>
          </section>
          <section className="panel">
            <h2>Delivery</h2>
            <p className="muted">
              Stored digests, scheduled runs, and email delivery via Resend.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
