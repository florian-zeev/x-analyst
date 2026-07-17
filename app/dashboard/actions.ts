"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { saveCollectionItemFromDigest } from "@/lib/collection";
import { verifyCollectionSaveToken } from "@/lib/collection-token";
import { runDigestForProfile } from "@/lib/digest";
import { getCurrentUserProfile } from "@/lib/profile";

export type CollectionSaveState = {
  type: "idle" | "success" | "error";
  message: string;
};

export type CollectionRemoveState = CollectionSaveState;

export type CollectionNoteState = CollectionSaveState & {
  note: string;
};

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
  const deliveryTimezone =
    String(formData.get("deliveryTimezone") ?? "").trim() || "Europe/Berlin";
  const deliveryTime =
    String(formData.get("deliveryTime") ?? "").trim() || "08:00";

  if (!isValidDeliveryTime(deliveryTime)) {
    redirect(
      "/profile?type=error&message=Delivery time must use HH:MM format."
    );
  }

  if (!isValidTimeZone(deliveryTimezone)) {
    redirect(
      `/profile?type=error&message=${encodeURIComponent(
        "Delivery timezone must be a valid IANA timezone, for example Europe/Berlin."
      )}`
    );
  }

  const discoveryQueries = String(formData.get("discoveryQueries") ?? "")
    .split("\n")
    .map((query) => query.trim())
    .filter(Boolean);
  if (!discoveryQueries.length) {
    redirect(
      `/profile?type=error&message=${encodeURIComponent(
        "Add at least one discovery query before saving your profile."
      )}`
    );
  }
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
    delivery_timezone: deliveryTimezone,
    delivery_time: deliveryTime,
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
          delivery_timezone: deliveryTimezone,
          delivery_time: deliveryTime,
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

function isValidDeliveryTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
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
    redirect(`/briefs?type=error&message=${encodeURIComponent(message)}`);
  }

  if (emailError) {
    revalidatePath("/dashboard");
    revalidatePath("/briefs");
    redirect(
      `/briefs/${digestId}?type=warning&message=${encodeURIComponent(
        `Brief generated, but email delivery failed: ${emailError}`
      )}`
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/briefs");
  redirect(`/briefs/${digestId}`);
}

export async function deleteDigest(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const digestId = String(formData.get("digestId") ?? "");
  if (!digestId) {
    redirect("/briefs?type=error&message=Missing brief id.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("digests")
    .delete()
    .eq("id", digestId)
    .eq("user_id", profile.userId);

  if (error) {
    redirect(`/briefs?type=error&message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/briefs");
  redirect("/briefs");
}

export async function saveArticleFeedback(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const direction = String(formData.get("direction"));
  if (direction !== "more" && direction !== "less") {
    redirect("/briefs?type=error&message=Invalid feedback direction.");
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
    redirect(`/briefs/${digestId}?type=error&message=${encodeURIComponent(message)}`);
  }

  const rejectionUpdate =
    direction === "less"
      ? { rejected_at: new Date().toISOString() }
      : { rejected_at: null };
  const { error: rejectionError } = await admin
    .from("digest_items")
    .update(rejectionUpdate)
    .eq("user_id", profile.userId)
    .eq("url", itemUrl);

  if (rejectionError && isMissingRejectedColumn(rejectionError)) {
    redirect(
      `/briefs/${digestId}?type=warning&message=${encodeURIComponent(
        "Feedback saved, but rejected articles need the latest Supabase schema. Run supabase/schema.sql so less-like-this can hide items."
      )}`
    );
  }

  if (rejectionError && rejectionError.code !== "PGRST204") {
    redirect(
      `/briefs/${digestId}?type=error&message=${encodeURIComponent(
        rejectionError.message
      )}`
    );
  }

  revalidatePath(`/briefs/${digestId}`);
  revalidatePath("/topics");
  revalidatePath("/rejected");
  revalidatePath("/learning");
  redirect(`/briefs/${digestId}?type=success&message=Feedback saved.`);
}

export async function restoreRejectedArticle(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const itemUrl = String(formData.get("itemUrl") ?? "");
  const itemTitle = String(formData.get("itemTitle") ?? "");
  const sourceLabel = String(formData.get("sourceLabel") ?? "");
  const viaHandle = String(formData.get("viaHandle") ?? "");
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!itemUrl) {
    redirect("/rejected?type=error&message=Missing article URL.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("digest_items")
    .update({ rejected_at: null })
    .eq("user_id", profile.userId)
    .eq("url", itemUrl);

  if (error) {
    if (isMissingRejectedColumn(error)) {
      redirect(
        "/rejected?type=error&message=Rejected articles need the latest Supabase schema. Run supabase/schema.sql, then try again."
      );
    }

    redirect(`/rejected?type=error&message=${encodeURIComponent(error.message)}`);
  }

  await admin.from("article_feedback").insert({
    user_id: profile.userId,
    item_url: itemUrl,
    item_title: itemTitle,
    source_label: sourceLabel,
    via_handle: viaHandle,
    tags,
    direction: "more",
    reason: "restored",
    note: "Restored from rejected articles."
  });

  revalidatePath("/rejected");
  revalidatePath("/topics");
  revalidatePath("/briefs");
  revalidatePath("/learning");
  redirect("/rejected?type=success&message=Article restored.");
}

export async function saveCollectionItem(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const digestId = String(formData.get("digestId") ?? "");
  const itemUrl = String(formData.get("itemUrl") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!digestId || !itemUrl) {
    redirect("/collection?type=error&message=Missing collection item.");
  }

  try {
    await saveCollectionItemFromDigest({
      userId: profile.userId,
      digestId,
      itemUrl,
      note
    });
  } catch (error) {
    const message = collectionErrorMessage(error);
    redirect(
      `/briefs/${digestId}?type=error&message=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/collection");
  revalidatePath(`/briefs/${digestId}`);
  redirect(
    `/briefs/${digestId}?type=success&message=${encodeURIComponent(
      "Saved to collection."
    )}`
  );
}

export async function saveCollectionItemInline(
  _previousState: CollectionSaveState,
  formData: FormData
): Promise<CollectionSaveState> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return {
      type: "error" as const,
      message: "Sign in again to save this item."
    };
  }

  const digestId = String(formData.get("digestId") ?? "");
  const itemUrl = String(formData.get("itemUrl") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!digestId || !itemUrl) {
    return {
      type: "error" as const,
      message: "Missing collection item."
    };
  }

  try {
    await saveCollectionItemFromDigest({
      userId: profile.userId,
      digestId,
      itemUrl,
      note
    });
  } catch (error) {
    return {
      type: "error" as const,
      message: collectionErrorMessage(error)
    };
  }

  revalidatePath("/collection");
  revalidatePath(`/briefs/${digestId}`);
  return {
    type: "success" as const,
    message: "Saved to collection."
  };
}

export async function removeCollectionItemInline(
  _previousState: CollectionRemoveState,
  formData: FormData
): Promise<CollectionRemoveState> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return {
      type: "error" as const,
      message: "Sign in again to remove this item."
    };
  }

  const digestId = String(formData.get("digestId") ?? "");
  const itemUrl = String(formData.get("itemUrl") ?? "");

  if (!digestId || !itemUrl) {
    return {
      type: "error" as const,
      message: "Missing collection item."
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_items")
    .delete()
    .eq("user_id", profile.userId)
    .eq("digest_id", digestId)
    .eq("url", itemUrl);

  if (error) {
    return {
      type: "error" as const,
      message: collectionErrorMessage(error)
    };
  }

  revalidatePath("/collection");
  revalidatePath(`/briefs/${digestId}`);
  return {
    type: "success" as const,
    message: "Removed from collection."
  };
}

export async function removeCollectionItem(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const collectionItemId = String(formData.get("collectionItemId") ?? "");

  if (!collectionItemId) {
    redirect("/collection?type=error&message=Missing collection item.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_items")
    .delete()
    .eq("user_id", profile.userId)
    .eq("id", collectionItemId);

  if (error) {
    redirect(
      `/collection?type=error&message=${encodeURIComponent(
        collectionErrorMessage(error)
      )}`
    );
  }

  revalidatePath("/collection");
  revalidatePath("/briefs");
  redirect(
    `/collection?type=success&message=${encodeURIComponent(
      "Removed from collection."
    )}`
  );
}

export async function updateCollectionItemNote(
  _previousState: CollectionNoteState,
  formData: FormData
): Promise<CollectionNoteState> {
  const profile = await getCurrentUserProfile();
  const note = String(formData.get("note") ?? "").trim();

  if (!profile) {
    return {
      type: "error" as const,
      message: "Sign in again to edit this note.",
      note
    };
  }

  const collectionItemId = String(formData.get("collectionItemId") ?? "");

  if (!collectionItemId) {
    return {
      type: "error" as const,
      message: "Missing collection item.",
      note
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_items")
    .update({
      note,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", profile.userId)
    .eq("id", collectionItemId);

  if (error) {
    return {
      type: "error" as const,
      message: collectionErrorMessage(error),
      note
    };
  }

  revalidatePath("/collection");
  revalidatePath("/learning");
  return {
    type: "success" as const,
    message: "Note saved.",
    note
  };
}

export async function saveCollectionItemFromEmail(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const payload = verifyCollectionSaveToken(token);

  if (!payload) {
    redirect(
      "/collection/save?type=error&message=This save link is invalid or expired."
    );
  }

  try {
    await saveCollectionItemFromDigest({
      userId: payload.userId,
      digestId: payload.digestId,
      itemUrl: payload.url,
      note
    });
  } catch (error) {
    const message = collectionErrorMessage(error);
    redirect(
      `/collection/save?type=error&message=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/collection");
  redirect(
    `/collection/save?type=success&message=${encodeURIComponent(
      "Saved to collection."
    )}`
  );
}

function isMissingRejectedColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.includes("rejected_at") ||
    error.message?.includes("schema cache")
  );
}

function collectionErrorMessage(error: unknown) {
  const details = normalizeActionError(error);

  if (
    details.code === "42P01" ||
    details.code === "42703" ||
    details.code === "PGRST204" ||
    details.code === "PGRST205" ||
    details.message.includes("collection_items") ||
    details.message.includes("schema cache")
  ) {
    return "Collection needs the latest Supabase schema. Run supabase/schema.sql, then try saving again.";
  }

  return details.message || "Could not save this item.";
}

function normalizeActionError(error: unknown) {
  if (error instanceof Error) {
    return {
      code: "",
      message: error.message
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "";
    const message =
      typeof record.message === "string"
        ? record.message
        : JSON.stringify(record);

    return { code, message };
  }

  return {
    code: "",
    message: String(error || "")
  };
}
