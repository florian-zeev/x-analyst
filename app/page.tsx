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
                Dashboard
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
          <div className="home-card-icon" aria-hidden="true">
            <SignalIcon />
          </div>
          <h2>Your signal</h2>
          <p>
            Tell X Analyst what matters. It uses that profile to decide what
            deserves to make the brief.
          </p>
        </article>
        <article>
          <div className="home-card-icon" aria-hidden="true">
            <FeedbackIcon />
          </div>
          <h2>Your feedback</h2>
          <p>
            Mark items as more or less useful, and future briefs adapt to your
            judgment.
          </p>
        </article>
        <article>
          <div className="home-card-icon" aria-hidden="true">
            <MorningIcon />
          </div>
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

function SignalIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M4 7h10" />
      <path d="M4 12h16" />
      <path d="M4 17h7" />
      <circle cx="17" cy="17" r="3" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M5 5h14v10H9l-4 4V5z" />
      <path d="M9 10h6" />
    </svg>
  );
}

function MorningIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M12 4v3" />
      <path d="M5 14a7 7 0 0 1 14 0" />
      <path d="M3 18h18" />
      <path d="M7 21h10" />
    </svg>
  );
}
