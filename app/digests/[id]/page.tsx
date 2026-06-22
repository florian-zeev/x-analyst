import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function DigestPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: digest } = await admin
    .from("digests")
    .select("*")
    .eq("id", id)
    .eq("user_id", profile.userId)
    .maybeSingle();

  if (!digest) {
    notFound();
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1 className="brand">X Analyst</h1>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </aside>
      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">{new Date(digest.created_at).toDateString()}</p>
            <h1>{digest.subject}</h1>
          </div>
        </div>
        <article className="brief">{digest.body_md}</article>
      </section>
    </main>
  );
}
