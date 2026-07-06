import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/dashboard/actions";

const navItems = [
  { href: "/dashboard", key: "dashboard", label: "Overview" },
  { href: "/profile", key: "profile", label: "Profile" },
  { href: "/digests", key: "digests", label: "Digests" },
  { href: "/topics", key: "topics", label: "Topics" },
  { href: "/learning", key: "learning", label: "Learning" }
] as const;

export function AppShell({
  active,
  children
}: {
  active: "dashboard" | "profile" | "digests" | "topics" | "learning";
  children: ReactNode;
}) {
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
          <nav className="mobile-nav">{renderNav(active)}</nav>
        </details>
      </header>
      <aside className="sidebar">
        <Link className="brand" href="/">
          X Analyst
        </Link>
        <nav className="nav">{renderNav(active)}</nav>
      </aside>
      <section className="main">{children}</section>
    </main>
  );
}

function renderNav(active: (typeof navItems)[number]["key"]) {
  return (
    <>
      {navItems.map((item) => (
        <Link
          aria-current={active === item.key ? "page" : undefined}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
