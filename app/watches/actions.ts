"use server";

import { revalidatePath } from "next/cache";
import { parseStructuredBrief } from "@/lib/brief";
import { getCurrentUserProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { watchCoversFollowup } from "@/lib/watch-helpers";
import {
  activateWatchFromFollowup,
  deleteWatch,
  setWatchStatus,
  updateWatch,
  WatchLimitError
} from "@/lib/watches";
import type { WatchActionState } from "@/app/watches/state";

export async function startWatch(
  _previousState: WatchActionState,
  formData: FormData
): Promise<WatchActionState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { type: "error", message: "Please sign in again." };
  }

  const digestId = String(formData.get("digestId") ?? "");
  const followupId = String(formData.get("followupId") ?? "");
  if (!digestId || !followupId) {
    return { type: "error", message: "Missing follow-up details." };
  }

  const admin = createAdminClient();
  const { data: digest, error } = await admin
    .from("digests")
    .select("body_md")
    .eq("id", digestId)
    .eq("user_id", profile.userId)
    .maybeSingle();

  if (error || !digest) {
    return { type: "error", message: "This brief could not be found." };
  }

  const structured = parseStructuredBrief(digest.body_md);
  const followup = structured?.brief.followups.find(
    (item) => item.id === followupId
  );
  if (!followup) {
    return { type: "error", message: "This follow-up is no longer available." };
  }
  if (followup.targetWatchId) {
    const { data: targetWatch } = await admin
      .from("watches")
      .select("id,title,objective")
      .eq("id", followup.targetWatchId)
      .eq("user_id", profile.userId)
      .eq("status", "active")
      .maybeSingle();
    if (targetWatch && watchCoversFollowup(targetWatch, followup)) {
      return {
        type: "success",
        message: "This follow-up is actively tracked.",
        watchId: targetWatch.id
      };
    }
  }

  try {
    const result = await activateWatchFromFollowup({
      userId: profile.userId,
      digestId,
      followup
    });
    revalidateWatchPaths(digestId);
    return {
      type: "success",
      message:
        result.searchQuality === "too_narrow"
          ? `Focus tracker started with ${result.validatedQueryCount} focused search${result.validatedQueryCount === 1 ? "" : "es"}. No useful recent matches were found, so X Analyst will keep looking.`
          : `Focus tracker started with ${result.validatedQueryCount} relevance-checked search${result.validatedQueryCount === 1 ? "" : "es"}. ${result.relevantPostCount} of ${result.matchedPostCount} sampled posts matched the objective.`,
      watchId: result.watch.id
    };
  } catch (activationError) {
    if (activationError instanceof WatchLimitError) {
      return { type: "limit", message: activationError.message };
    }
    return {
      type: "error",
      message:
        activationError instanceof Error
          ? activationError.message
          : "Could not start this watch."
    };
  }
}

export async function undoStartedWatch(
  _previousState: WatchActionState,
  formData: FormData
): Promise<WatchActionState> {
  return changeStatus(formData, "archived", "Focus tracker archived.");
}

export async function changeWatchStatus(
  _previousState: WatchActionState,
  formData: FormData
): Promise<WatchActionState> {
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "paused" && status !== "archived") {
    return { type: "error", message: "Invalid watch status." };
  }

  return changeStatus(
    formData,
    status,
    status === "active"
      ? "Focus tracker resumed."
      : status === "paused"
        ? "Focus tracker paused."
        : "Focus tracker archived."
  );
}

async function changeStatus(
  formData: FormData,
  status: "active" | "paused" | "archived",
  message: string
): Promise<WatchActionState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { type: "error", message: "Please sign in again." };
  }

  const watchId = String(formData.get("watchId") ?? "");
  if (!watchId) {
    return { type: "error", message: "Missing watch id." };
  }

  try {
    await setWatchStatus({ userId: profile.userId, watchId, status });
    revalidatePath("/watches");
    revalidatePath("/briefs");
    return { type: "success", message, watchId };
  } catch (error) {
    if (error instanceof WatchLimitError) {
      return { type: "limit", message: error.message, watchId };
    }
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Could not update watch.",
      watchId
    };
  }
}

export async function saveWatch(
  _previousState: WatchActionState,
  formData: FormData
): Promise<WatchActionState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { type: "error", message: "Please sign in again." };
  }

  const watchId = String(formData.get("watchId") ?? "");
  try {
    const result = await updateWatch({
      userId: profile.userId,
      watchId,
      title: String(formData.get("title") ?? ""),
      objective: String(formData.get("objective") ?? ""),
      xQuery: String(formData.get("xQuery") ?? "")
    });
    revalidatePath("/watches");
    return {
      type: "success",
      message:
        result.quality === "too_narrow"
          ? "Focus tracker saved. The searches are focused but quiet right now."
          : `Focus tracker saved. ${result.relevantPostCount} of ${result.matchedPostCount} sampled posts matched the objective.`,
      watchId
    };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Could not save watch.",
      watchId
    };
  }
}

export async function deleteWatchAction(
  _previousState: WatchActionState,
  formData: FormData
): Promise<WatchActionState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { type: "error", message: "Please sign in again." };
  }

  const watchId = String(formData.get("watchId") ?? "");
  if (!watchId) {
    return { type: "error", message: "Missing watch id." };
  }

  try {
    await deleteWatch({ userId: profile.userId, watchId });
    revalidatePath("/watches");
    revalidatePath("/briefs");
    return { type: "success", message: "Focus tracker deleted.", watchId };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Could not delete watch.",
      watchId
    };
  }
}

function revalidateWatchPaths(digestId: string) {
  revalidatePath("/watches");
  revalidatePath(`/briefs/${digestId}`);
}
