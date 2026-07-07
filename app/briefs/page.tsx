import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { generateBrief } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { BriefsTable } from "@/app/briefs/BriefsTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function BriefsPage({
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
  const { data: digests } = await admin
    .from("digests")
    .select("*")
    .eq("user_id", profile.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <AppShell active="briefs">
      <div className="topbar">
        <div>
          <p className="eyebrow">Briefs</p>
          <h1>Brief archive</h1>
          <p className="muted">
            Browse, open, and delete generated daily briefs.
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

      <section className="panel">
        <h2>All briefs</h2>
        <BriefsTable
          digests={digests ?? []}
          timeZone={profile.deliveryTimezone}
        />
      </section>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}
