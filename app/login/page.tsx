import { redirect } from "next/navigation";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { signIn } from "@/app/login/actions";
import { isAllowedEmail } from "@/lib/authz";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!hasSupabasePublicEnv()) {
    return (
      <main className="shell">
        <aside className="sidebar">
          <h1 className="brand">X Analyst</h1>
          <p className="muted">Magic-link authentication via Supabase.</p>
        </aside>
        <section className="main">
          <p className="notice">
            Supabase is not configured yet. Add the values from `.env.example`
            to `.env.local`, then restart the dev server.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    const email = String(data.claims.email ?? "").toLowerCase();
    if (isAllowedEmail(email)) {
      redirect("/dashboard");
    }

    redirect("/auth/sign-out");
  }

  const params = await searchParams;

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1 className="brand">X Analyst</h1>
        <p className="muted">Magic-link authentication via Supabase.</p>
      </aside>
      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Access</p>
            <h1>Sign in</h1>
          </div>
        </div>
        <form className="panel form auth-form" action={signIn}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <SubmitButton
            className="button"
            idleLabel="Send magic link"
            pendingLabel="Sending..."
          />
          {params.message ? <p className="muted">{params.message}</p> : null}
        </form>
      </section>
    </main>
  );
}
