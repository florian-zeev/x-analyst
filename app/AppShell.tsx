import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/dashboard/actions";
import { isAdminEmail } from "@/lib/authz";
import { getCurrentUserProfile } from "@/lib/profile";

export const GITHUB_REPO_URL = "https://github.com/florian-zeev/x-analyst";

const navItems = [
  { href: "/dashboard", key: "dashboard", label: "Overview" },
  { href: "/profile", key: "profile", label: "Profile" },
  { href: "/digests", key: "digests", label: "Briefs" },
  { href: "/topics", key: "topics", label: "Topics" },
  { href: "/collection", key: "collection", label: "Collection" },
  { href: "/learning", key: "learning", label: "Learning" },
  { href: "/rejected", key: "rejected", label: "Rejected" },
  { href: "/waitlist", key: "waitlist", label: "Waitlist" }
] as const;

export async function AppShell({
  active,
  children
}: {
  active:
    | "dashboard"
    | "profile"
    | "digests"
    | "topics"
    | "collection"
    | "waitlist"
    | "rejected"
    | "learning";
  children: ReactNode;
}) {
  const profile = await getCurrentUserProfile();
  const email = profile?.email ?? "";
  const isAdmin = isAdminEmail(email);

  return (
    <main className="shell">
      <header className="mobile-header">
        <Link className="mobile-brand" href="/">
          X Analyst
        </Link>
        <details className="mobile-menu">
          <summary aria-label="Open navigation">
            <span />
            <span />
            <span />
          </summary>
          <nav className="mobile-nav">{renderNav(active, email, isAdmin)}</nav>
        </details>
      </header>
      <aside className="sidebar">
        <Link className="brand" href="/">
          X Analyst
        </Link>
        <nav className="nav">{renderNav(active, email, isAdmin)}</nav>
      </aside>
      <section className="main">{children}</section>
    </main>
  );
}

function renderNav(
  active: (typeof navItems)[number]["key"],
  email: string,
  isAdmin: boolean
) {
  return (
    <>
      <div className="nav-primary">
        {navItems
          .filter((item) => item.key !== "waitlist" || isAdmin)
          .map((item) => (
            <Link
              aria-current={active === item.key ? "page" : undefined}
              data-nav-key={item.key}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
      </div>
      <div className="nav-account">
        {email ? <p title={email}>{email}</p> : null}
        <form action={signOut}>
          <button aria-label="Sign out" title="Sign out" type="submit">
            <SignOutIcon />
          </button>
        </form>
      </div>
      <p className="sidebar-credit">
        <a href={GITHUB_REPO_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
      </p>
    </>
  );
}

export function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
