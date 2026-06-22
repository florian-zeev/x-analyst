import { redirect } from "next/navigation";
import { signIn } from "@/app/login/actions";
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
    redirect("/dashboard");
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
        <form className="panel form" action={signIn}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button className="button" type="submit">
            Send magic link
          </button>
          {params.message ? <p className="muted">{params.message}</p> : null}
        </form>
      </section>
    </main>
  );
}
