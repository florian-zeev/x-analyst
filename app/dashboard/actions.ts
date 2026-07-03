"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runDigestForProfile } from "@/lib/digest";
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
  const priorityHandles = String(formData.get("priorityHandles") ?? "")
    .split("\n")
    .map((handle) => normalizeHandle(handle))
    .filter(Boolean);

  const admin = createAdminClient();
  const updatePayload = {
    interest_profile_md: interestProfileMd,
    x_list_id: xListId,
    discovery_queries: discoveryQueries,
    priority_handles: priorityHandles,
    digest_email: digestEmail,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin
    .from("analyst_profiles")
    .update(updatePayload)
    .eq("user_id", profile.userId);

  if (error) {
    if (error.code === "PGRST204") {
      const { error: fallbackError } = await admin
        .from("analyst_profiles")
        .update({
          interest_profile_md: interestProfileMd,
          x_list_id: xListId,
          discovery_queries: discoveryQueries,
          digest_email: digestEmail,
          updated_at: updatePayload.updated_at
        })
        .eq("user_id", profile.userId);

      if (fallbackError) {
        redirect(
          `/profile?type=error&message=${encodeURIComponent(fallbackError.message)}`
        );
      }

      redirect(
        "/profile?type=warning&message=Profile saved, but priority handles were not saved because the Supabase column is missing. Run the priority_handles migration."
      );
    }

    redirect(`/profile?type=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  redirect("/profile?type=success&message=Profile saved.");
}

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function generateBrief() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  let digestId: string;
  try {
    const result = await runDigestForProfile(profile);
    digestId = result.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brief generation failed.";
    redirect(`/digests?type=error&message=${encodeURIComponent(message)}`);
  }

  redirect(`/digests/${digestId}`);
}

export async function deleteDigest(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const digestId = String(formData.get("digestId") ?? "");
  if (!digestId) {
    redirect("/digests?type=error&message=Missing digest id.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("digests")
    .delete()
    .eq("id", digestId)
    .eq("user_id", profile.userId);

  if (error) {
    redirect(`/digests?type=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/digests");
  redirect("/digests");
}
