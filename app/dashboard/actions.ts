"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/profile";

export async function saveProfile(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const interestProfileMd = String(
    formData.get("interestProfileMd") ?? ""
  ).trim();
  const xListId = String(formData.get("xListId") ?? "").trim() || null;
  const digestEmail = String(formData.get("digestEmail") ?? "").trim() || null;
  const discoveryQueries = String(formData.get("discoveryQueries") ?? "")
    .split("\n")
    .map((query) => query.trim())
    .filter(Boolean);

  const admin = createAdminClient();
  const { error } = await admin
    .from("analyst_profiles")
    .update({
      interest_profile_md: interestProfileMd,
      x_list_id: xListId,
      discovery_queries: discoveryQueries,
      digest_email: digestEmail,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", profile.userId);

  if (error) {
    throw error;
  }

  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
