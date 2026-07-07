import { redirect } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";
import { isMissingWaitlistTable } from "@/lib/waitlist";

export default async function WaitlistPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: requests, error } = await admin
    .from("waitlist_requests")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

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
            People who tried to sign in without allowlist access.
          </p>
        </div>
      </div>

      <section className="panel">
        {requests?.length ? (
          <div className="waitlist-list">
            {requests.map((request) => (
              <article className="waitlist-row" key={request.email}>
                <div>
                  <h2>{request.email}</h2>
                  <p>
                    {request.status} · {request.request_count}{" "}
                    {request.request_count === 1 ? "request" : "requests"}
                  </p>
                </div>
                <div>
                  <p>First: {new Date(request.created_at).toLocaleString()}</p>
                  <p>Latest: {new Date(request.updated_at).toLocaleString()}</p>
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
