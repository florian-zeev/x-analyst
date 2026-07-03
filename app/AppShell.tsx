import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/dashboard/actions";

export function AppShell({
  active,
  children
}: {
  active: "dashboard" | "profile" | "digests" | "topics" | "learning";
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <h1 className="brand">X Analyst</h1>
        <nav className="nav">
          <Link aria-current={active === "dashboard" ? "page" : undefined} href="/dashboard">
            Overview
          </Link>
          <Link aria-current={active === "profile" ? "page" : undefined} href="/profile">
            Profile
          </Link>
          <Link aria-current={active === "digests" ? "page" : undefined} href="/digests">
            Digests
          </Link>
          <Link aria-current={active === "topics" ? "page" : undefined} href="/topics">
            Topics
          </Link>
          <Link aria-current={active === "learning" ? "page" : undefined} href="/learning">
            Learning
          </Link>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </aside>
      <section className="main">{children}</section>
    </main>
  );
}
