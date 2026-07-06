import Link from "next/link";
import { SignOutIcon } from "@/app/AppShell";
import { signOut } from "@/app/dashboard/actions";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function Home() {
  const profile = hasSupabasePublicEnv()
    ? await getCurrentUserProfile()
    : null;

  const isSignedIn = Boolean(profile);

  return (
    <main className="home">
      <header className="home-header">
        <Link className="home-brand" href="/">
          X Analyst
        </Link>
        <nav className="home-nav">
          {isSignedIn ? (
            <>
              <Link href="/digests">Digests</Link>
              <Link className="button landing-sign-in" href="/dashboard">
                Open dashboard
              </Link>
              <div className="home-account">
                <span title={profile?.email}>{profile?.email}</span>
                <form action={signOut}>
                  <button aria-label="Sign out" title="Sign out" type="submit">
                    <SignOutIcon />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <Link className="button landing-sign-in" href="/login">
              Sign in
            </Link>
          )}
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
