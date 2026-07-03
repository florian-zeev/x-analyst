import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { saveProfile } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { getCurrentUserProfile } from "@/lib/profile";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <AppShell active="profile">
      <div className="topbar">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Sources and interests</h1>
          <p className="muted">
            Tune the X sources, discovery queries, recipient, and Markdown
            interest profile used for each brief.
          </p>
        </div>
      </div>
      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      <form className="panel form" action={saveProfile}>
        <label>
          X list ID
          <input
            name="xListId"
            defaultValue={profile.xListId ?? ""}
            placeholder="Example: 1234567890"
          />
        </label>
        <label>
          Discovery queries, one per line
          <textarea
            name="discoveryQueries"
            defaultValue={profile.discoveryQueries.join("\n")}
          />
        </label>
        <label>
          Priority X handles, one per line
          <textarea
            name="priorityHandles"
            defaultValue={profile.priorityHandles.map((handle) => `@${handle}`).join("\n")}
            placeholder="@sama&#10;@karpathy&#10;@rauchg"
          />
        </label>
        <label>
          Delivery email
          <input
            name="digestEmail"
            type="email"
            defaultValue={profile.digestEmail ?? profile.email}
          />
          <span className="field-help">
            Defaults to your login email: {profile.email}
          </span>
        </label>
        <label>
          Markdown interest profile
          <textarea
            name="interestProfileMd"
            defaultValue={profile.interestProfileMd}
            style={{ minHeight: 420 }}
          />
        </label>
        <div className="actions">
          <SubmitButton
            className="button"
            idleLabel="Save profile"
            pendingLabel="Saving..."
          />
        </div>
      </form>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}
