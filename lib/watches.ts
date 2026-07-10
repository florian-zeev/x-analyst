import type { FollowupProposal, WatchRunCheck } from "@/lib/brief";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";
import { ACTIVE_WATCH_LIMIT } from "@/lib/watch-helpers";
import {
  prepareGeneratedWatchQueries,
  validateEditedWatchQueries
} from "@/lib/watch-query";

export { ACTIVE_WATCH_LIMIT } from "@/lib/watch-helpers";

export type Watch = Database["public"]["Tables"]["watches"]["Row"];
export type WatchCheck =
  Database["public"]["Tables"]["watch_checks"]["Row"];

export async function getWatches(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("watches")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingWatchSchemaError(error)) {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function getActiveWatches(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("watches")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(ACTIVE_WATCH_LIMIT);

  if (error) {
    if (isMissingWatchSchemaError(error)) {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function getRecentWatchChecks(
  userId: string,
  watches: Watch[],
  limit = 30
) {
  if (!watches.length) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("watch_checks")
    .select("*")
    .eq("user_id", userId)
    .in(
      "watch_id",
      watches.map((watch) => watch.id)
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingWatchSchemaError(error)) {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function activateWatchFromFollowup(options: {
  userId: string;
  digestId: string;
  followup: FollowupProposal;
}) {
  const { followup } = options;
  if (!followup.actionable) {
    throw new Error("This legacy follow-up cannot be started as a watch.");
  }

  const prepared = await prepareGeneratedWatchQueries({
    title: followup.watchTitle.trim() || followup.title.trim(),
    objective: followup.watchObjective.trim() || followup.description.trim(),
    seedQuery: followup.xQuery
  });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("activate_watch_from_followup", {
    p_user_id: options.userId,
    p_source_digest_id: options.digestId,
    p_source_followup_id: followup.id,
    p_title: followup.watchTitle.trim() || followup.title.trim(),
    p_objective: followup.watchObjective.trim() || followup.description.trim(),
    p_x_query: prepared.query
  });

  if (error) {
    if (error.message.includes("active_watch_limit")) {
      throw new WatchLimitError();
    }
    if (isMissingWatchSchemaError(error)) {
      throw new Error(
        "Focus trackers need the latest Supabase schema. Run supabase/schema.sql, then try again."
      );
    }
    throw error;
  }

  const watch =
    data.status === "active"
      ? data
      : await setWatchStatus({
          userId: options.userId,
          watchId: data.id,
          status: "active"
        });

  return {
    watch,
    validatedQueryCount: prepared.queryCount,
    matchedPostCount: prepared.matchedPostCount,
    relevantPostCount: prepared.relevantPostCount,
    searchQuality: prepared.quality
  };
}

export async function finalizeWatchChecks(options: {
  userId: string;
  digestId: string;
  checks: Array<WatchRunCheck & { digestItemId?: string | null }>;
}) {
  const admin = createAdminClient();
  const payload: Json = options.checks.map((check) => ({
    watch_id: check.watchId,
    digest_item_id: check.digestItemId ?? null,
    status: check.status,
    source_url: check.sourceUrl,
    headline: check.headline,
    evidence_summary: check.evidenceSummary,
    error_message: check.errorMessage
  }));
  const { error } = await admin.rpc("finalize_watch_checks", {
    p_user_id: options.userId,
    p_digest_id: options.digestId,
    p_checks: payload
  });

  if (error) {
    throw error;
  }
}

export async function setWatchStatus(options: {
  userId: string;
  watchId: string;
  status: Watch["status"];
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("set_watch_status", {
    p_user_id: options.userId,
    p_watch_id: options.watchId,
    p_status: options.status
  });

  if (error) {
    if (error.message.includes("active_watch_limit")) {
      throw new WatchLimitError();
    }
    throw error;
  }

  return data;
}

export async function deleteWatch(options: {
  userId: string;
  watchId: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("watches")
    .delete()
    .eq("id", options.watchId)
    .eq("user_id", options.userId);

  if (error) {
    throw error;
  }
}

export async function updateWatch(options: {
  userId: string;
  watchId: string;
  title: string;
  objective: string;
  xQuery: string;
}) {
  const title = options.title.trim();
  const objective = options.objective.trim();
  if (!title || !objective) {
    throw new Error("Watch title and objective are required.");
  }

  const prepared = await validateEditedWatchQueries({
    title,
    objective,
    query: options.xQuery
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("watches")
    .update({
      title,
      objective,
      x_query: prepared.query,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", options.watchId)
    .eq("user_id", options.userId);

  if (error) {
    throw error;
  }

  return prepared;
}

export function isMissingWatchSchemaError(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    Boolean(
      error.message?.includes("watches") ||
        error.message?.includes("watch_checks") ||
        error.message?.includes("schema cache")
    )
  );
}

export class WatchLimitError extends Error {
  constructor() {
    super(`You can have up to ${ACTIVE_WATCH_LIMIT} active focus trackers.`);
    this.name = "WatchLimitError";
  }
}
