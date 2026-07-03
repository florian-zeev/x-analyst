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
  let emailError: string | null = null;
  try {
    const result = await runDigestForProfile(profile);
    digestId = result.id;
    emailError = result.emailError;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brief generation failed.";
    redirect(`/digests?type=error&message=${encodeURIComponent(message)}`);
  }

  if (emailError) {
    redirect(
      `/digests/${digestId}?type=warning&message=${encodeURIComponent(
        `Brief generated, but email delivery failed: ${emailError}`
      )}`
    );
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

export async function saveArticleFeedback(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const direction = String(formData.get("direction"));
  if (direction !== "more" && direction !== "less") {
    redirect("/digests?type=error&message=Invalid feedback direction.");
  }

  const digestId = String(formData.get("digestId") ?? "");
  const itemUrl = String(formData.get("itemUrl") ?? "");
  const itemTitle = String(formData.get("itemTitle") ?? "");
  const sourceLabel = String(formData.get("sourceLabel") ?? "");
  const viaHandle = String(formData.get("viaHandle") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const admin = createAdminClient();
  const { error } = await admin.from("article_feedback").insert({
    user_id: profile.userId,
    digest_id: digestId || null,
    item_url: itemUrl,
    item_title: itemTitle,
    source_label: sourceLabel,
    via_handle: viaHandle,
    tags,
    direction,
    reason,
    note
  });

  if (error) {
    const message =
      error.code === "42P01" || error.code === "PGRST205"
        ? "Feedback table is missing. Run the article_feedback migration."
        : error.message;
    redirect(`/digests/${digestId}?type=error&message=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/digests/${digestId}`);
  revalidatePath("/learning");
  redirect(`/digests/${digestId}?type=success&message=Feedback saved.`);
}
