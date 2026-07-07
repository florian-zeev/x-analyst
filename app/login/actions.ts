"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessEmail } from "@/lib/access";
import { recordWaitlistRequest } from "@/lib/waitlist";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!(await canAccessEmail(email))) {
    await recordWaitlistRequest(email);
    redirect("/login?access=requested");
  }

  const supabase = await createClient();
  const origin = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Check your email for the magic link.");
}
