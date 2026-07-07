import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import {
  approveWaitlistRequest,
  blockWaitlistRequest
} from "@/app/waitlist/actions";
import { isAdminEmail } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";
import { isMissingWaitlistTable } from "@/lib/waitlist";

export default async function WaitlistPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; type?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isAdminEmail(profile.email)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: requests, error } = await admin
    .from("waitlist_requests")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  const requestEmails = requests?.map((request) => request.email) ?? [];
  const { data: accessRows, error: accessError } = requestEmails.length
    ? await admin
        .from("user_access")
        .select("email,status")
        .in("email", requestEmails)
    : { data: [], error: null };

  if (accessError && !isMissingAccessTable(accessError)) {
    throw accessError;
  }

  const accessByEmail = new Map(
    (accessRows ?? []).map((row) => [row.email, row.status])
  );

  if (error) {
    if (isMissingWaitlistTable(error)) {
      return (
        <AppShell active="waitlist">
          <div className="topbar">
            <div>
              <p className="eyebrow">Waitlist</p>
              <h1>Access requests</h1>
              <p className="muted">
                Waitlist needs the latest Supabase schema. Run
                supabase/schema.sql, then reload this page.
              </p>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }

  return (
    <AppShell active="waitlist">
      <div className="topbar">
        <div>
          <p className="eyebrow">Waitlist</p>
          <h1>Access requests</h1>
          <p className="muted">
            People who tried to sign in before being approved.
          </p>
        </div>
      </div>
      {params.message ? (
        <p className={`notice ${noticeType(params.type)}`}>{params.message}</p>
      ) : null}

      <section className="panel">
        {requests?.length ? (
          <div className="waitlist-list">
            {requests.map((request) => (
              <article className="waitlist-row" key={request.email}>
                <div>
                  <p className="waitlist-email">{request.email}</p>
                  <p>
                    {request.request_count}{" "}
                    {request.request_count === 1 ? "request" : "requests"}
                  </p>
                </div>
                <div>
                  <h2
                    className={`waitlist-status ${statusClass(
                      accessByEmail.get(request.email) ?? request.status
                    )}`}
                  >
                    {accessByEmail.get(request.email) ?? request.status}
                  </h2>
                </div>
                <div>
                  <p>First: {new Date(request.created_at).toLocaleString()}</p>
                  <p>Latest: {new Date(request.updated_at).toLocaleString()}</p>
                </div>
                <div>
                  <form action={approveWaitlistRequest}>
                    <input name="email" type="hidden" value={request.email} />
                    <button className="text-button" type="submit">
                      Approve
                    </button>
                  </form>
                  <form action={blockWaitlistRequest}>
                    <input name="email" type="hidden" value={request.email} />
                    <button className="text-button" type="submit">
                      Block
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No waitlist requests yet.</p>
        )}
      </section>
    </AppShell>
  );
}

function noticeType(type: string | undefined) {
  return type === "success" || type === "warning" ? type : "error";
}

function statusClass(status: string) {
  if (status === "approved") {
    return "approved";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "pending";
}

function isMissingAccessTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("user_access") ||
    error.message?.includes("schema cache")
  );
}
