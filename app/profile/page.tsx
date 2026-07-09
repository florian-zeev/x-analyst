import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { saveProfile } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { DeliveryScheduleFields } from "@/app/profile/DeliveryScheduleFields";
import { ProfileFieldInfo } from "@/app/profile/ProfileFieldInfo";
import { ProfileStarterTemplateButton } from "@/app/profile/ProfileStarterTemplate";
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
        <DeliveryScheduleFields
          deliveryTime={profile.deliveryTime}
          deliveryTimezone={profile.deliveryTimezone}
        />
        <div className="field">
          <FieldHeader
            htmlFor="xListId"
            label="X list ID"
            requirement="Optional"
            infoTitle="X list ID"
            template={<ProfileStarterTemplateButton fieldId="xListId" />}
          >
            <p>
              Adds posts from a curated X list to each brief. This is useful
              when you already have trusted sources you want X Analyst to scan.
            </p>
            <p>
              It is not required. You can use discovery queries and the interest
              profile without an X list.
            </p>
          </FieldHeader>
          <input
            id="xListId"
            name="xListId"
            defaultValue={profile.xListId ?? ""}
            placeholder="Example: 1234567890"
          />
        </div>
        <div className="field">
          <FieldHeader
            htmlFor="discoveryQueries"
            label="Discovery queries"
            requirement="Optional"
            infoTitle="Discovery queries"
            template={<ProfileStarterTemplateButton fieldId="discoveryQueries" />}
          >
            <p>
              Adds search-based discovery beyond your X list. Put one query per
              line, such as a product category, research theme, company name, or
              phrase you want watched.
            </p>
            <p>
              Optional on its own, but you should provide either an X list or
              discovery queries so the agent has source material to inspect.
            </p>
          </FieldHeader>
          <textarea
            id="discoveryQueries"
            name="discoveryQueries"
            defaultValue={profile.discoveryQueries.join("\n")}
            placeholder="One query per line"
          />
        </div>
        <div className="field">
          <FieldHeader
            htmlFor="priorityHandles"
            label="Priority X handles"
            requirement="Optional"
            infoTitle="Priority X handles"
            template={<ProfileStarterTemplateButton fieldId="priorityHandles" />}
          >
            <p>
              Gives extra attention to specific X accounts when their posts
              appear in the source set. This is good for people or companies you
              trust more than the average source.
            </p>
            <p>
              Optional. It changes prioritization; it does not replace your X
              list, discovery queries, or interest profile.
            </p>
          </FieldHeader>
          <textarea
            id="priorityHandles"
            name="priorityHandles"
            defaultValue={profile.priorityHandles.map((handle) => `@${handle}`).join("\n")}
            placeholder="@sama&#10;@karpathy&#10;@rauchg"
          />
        </div>
        <div className="field">
          <FieldHeader
            htmlFor="digestEmail"
            label="Delivery email"
            requirement="Required"
            infoTitle="Delivery email"
          >
            <p>
              The address that receives the daily brief. By default this is your
              login email, but you can send the brief somewhere else.
            </p>
            <p>
              Required because X Analyst is designed around daily email
              delivery.
            </p>
          </FieldHeader>
          <input
            id="digestEmail"
            name="digestEmail"
            type="email"
            defaultValue={profile.digestEmail ?? profile.email}
            required
          />
          <span className="field-help">
            Defaults to your login email: {profile.email}
          </span>
        </div>
        <div className="field">
          <FieldHeader
            htmlFor="interestProfileMd"
            label="Markdown interest profile"
            requirement="Required"
            infoTitle="Markdown interest profile"
            template={<ProfileStarterTemplateButton fieldId="interestProfileMd" />}
          >
            <p>
              This is the core instruction file for the brief. Describe what you
              care about, what should be ignored, and what makes something
              useful.
            </p>
            <p>
              Required. Without it, the agent cannot distinguish useful signal
              from generic news.
            </p>
          </FieldHeader>
          <textarea
            id="interestProfileMd"
            name="interestProfileMd"
            defaultValue={profile.interestProfileMd}
            required
            placeholder={`# Interest profile

I care about:
- strong new articles, primary sources, and substantive analysis in my topic area
- concrete developments, launches, research, policy changes, market signals, or field reports
- thoughtful essays, postmortems, benchmarks, explainers, and opposing views
- items that change how I should understand the domain or what I should pay attention to next

I care less about:
- vague hype
- recycled announcements
- generic engagement bait
- shallow commentary without evidence`}
            style={{ minHeight: 420 }}
          />
        </div>
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

function FieldHeader({
  htmlFor,
  label,
  requirement,
  infoTitle,
  template,
  children
}: {
  htmlFor: string;
  label: string;
  requirement: "Required" | "Optional";
  infoTitle: string;
  template?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="field-label-row">
      <label htmlFor={htmlFor}>{label}</label>
      <span className={`field-requirement ${requirement.toLowerCase()}`}>
        {requirement}
      </span>
      <ProfileFieldInfo title={infoTitle}>{children}</ProfileFieldInfo>
      {template}
    </div>
  );
}
