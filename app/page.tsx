import Link from "next/link";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let isSignedIn = false;

  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    isSignedIn = Boolean(data?.claims);
  }

  return (
    <main className="home">
      <header className="home-header">
        <Link className="home-brand" href="/">
          X Analyst
        </Link>
        <nav className="home-nav">
          {isSignedIn ? (
            <Link href="/digests">Digests</Link>
          ) : null}
          <Link
            className="button landing-sign-in"
            href={isSignedIn ? "/dashboard" : "/login"}
          >
            {isSignedIn ? "Open dashboard" : "Sign in"}
          </Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">Daily brief</p>
          <h1>Custom intelligence from X</h1>
          <p>
            Get the posts, links, and launches worth your attention, filtered
            by what you care about.
          </p>
        </div>
      </section>

      <section className="home-detail">
        <article>
          <h2>Your signal</h2>
          <p>
            Tell X Analyst what matters. It uses that profile to decide what
            deserves to make the brief.
          </p>
        </article>
        <article>
          <h2>Your feedback</h2>
          <p>
            Mark items as more or less useful, and future briefs adapt to your
            judgment.
          </p>
        </article>
        <article>
          <h2>Your morning</h2>
          <p>
            Receive a short daily brief by email, with every digest saved for
            review later.
          </p>
        </article>
      </section>

      <footer className="home-footer">
        <p>
          (c) 2026{" "}
          <a href="https://www.fwolf.io" rel="noreferrer" target="_blank">
            Florian Wolf
          </a>
        </p>
        {!hasSupabasePublicEnv() ? (
          <p className="notice">
            Supabase is not configured yet. Copy `.env.example` to `.env.local`
            and fill in the public Supabase URL and publishable key before
            signing in.
          </p>
        ) : null}
      </footer>
    </main>
  );
}
