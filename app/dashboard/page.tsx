import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { generateBrief } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { formatDateTime } from "@/lib/date-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: latestDigest } = await admin
    .from("digests")
    .select("*")
    .eq("user_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell active="dashboard">
      <div className="topbar">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Daily briefing setup</h1>
          <p className="muted">
            Signed in as {profile.email}. Configure sources in Profile, review
            generated briefs in Briefs, or run a new brief now.
          </p>
        </div>
        <form action={generateBrief}>
          <SubmitButton
            className="button secondary"
            idleLabel="Generate brief"
            pendingLabel="Generating..."
          />
        </form>
      </div>
      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      <div className="grid">
        <section className="panel">
          <h2>Profile</h2>
          <p className="muted">
            Edit your X list, discovery queries, email recipient, and interest
            profile.
          </p>
          <a className="button ghost" href="/profile">
            Edit profile
          </a>
        </section>
        <section className="panel">
          <h2>Briefs</h2>
          {latestDigest ? (
            <p className="muted">
              Latest:{" "}
              {formatDateTime(latestDigest.created_at, profile.deliveryTimezone)} ·{" "}
              {latestDigest.item_count} items
            </p>
          ) : (
            <p className="muted">No briefs generated yet.</p>
          )}
          <a className="button ghost" href="/briefs">
            View briefs
          </a>
        </section>
      </div>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}
