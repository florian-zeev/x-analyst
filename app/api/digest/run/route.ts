import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runDigestForProfile,
  sendStoredDigestEmail,
  type StoredDigestForEmail
} from "@/lib/digest";
import { getDeliveryDueState } from "@/lib/delivery-schedule";
import { getCurrentUserProfile, toProfile } from "@/lib/profile";
import { logBriefError, logBriefEvent, maskEmail } from "@/lib/brief-logs";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const runId = crypto.randomUUID();

  try {
    const auth = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && auth === `Bearer ${cronSecret}`) {
      logBriefEvent("cron_run_started", {
        runId,
        path: request.nextUrl.pathname
      });

      const admin = createAdminClient();
      const { data, error } = await admin.from("analyst_profiles").select("*");

      if (error) {
        logBriefError("cron_profile_query_failed", error, { runId });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logBriefEvent("cron_profiles_loaded", {
        runId,
        profileCount: data?.length ?? 0
      });

      const results = [];
      const skipped = [];
      for (const row of data ?? []) {
        const profile = toProfile(row);
        const dueState = getDeliveryDueState(profile);
        const profileLog = {
          runId,
          userId: profile.userId,
          email: maskEmail(profile.email),
          localDate: dueState.localDate,
          localTime: dueState.localTime,
          deliveryTime: profile.deliveryTime,
          timezone: profile.deliveryTimezone
        };

        logBriefEvent("cron_profile_due_checked", {
          ...profileLog,
          due: dueState.due
        });

        if (!dueState.due) {
          logBriefEvent("cron_profile_skipped", {
            ...profileLog,
            reason: "not_due"
          });
          skipped.push({
            email: profile.email,
            reason: "not_due",
            localDate: dueState.localDate,
            localTime: dueState.localTime,
            deliveryTime: profile.deliveryTime,
            timezone: profile.deliveryTimezone
          });
          continue;
        }

        const existingDigest = await findDigestForLocalDate(
          profile.userId,
          dueState.localDate,
          dueState.deliveryTime
        );
        if (existingDigest?.sent_at) {
          logBriefEvent("cron_profile_skipped", {
            ...profileLog,
            reason: "already_sent",
            digestId: existingDigest.id,
            digestCreatedAt: existingDigest.created_at,
            sentAt: existingDigest.sent_at,
            itemCount: existingDigest.item_count
          });
          skipped.push({
            email: profile.email,
            reason: "already_sent",
            localDate: dueState.localDate,
            digestId: existingDigest.id,
            deliveryTime: profile.deliveryTime,
            timezone: profile.deliveryTimezone
          });
          continue;
        }

        if (existingDigest) {
          logBriefEvent("cron_profile_existing_unsent_digest_found", {
            ...profileLog,
            digestId: existingDigest.id,
            digestCreatedAt: existingDigest.created_at,
            itemCount: existingDigest.item_count
          });
          const result = await sendStoredDigestEmail(profile, existingDigest, {
            localDate: dueState.localDate,
            deliveryTime: dueState.deliveryTime,
            runId,
            trigger: "schedule"
          });
          results.push({ ...result, itemCount: existingDigest.item_count });
          continue;
        }

        try {
          logBriefEvent("cron_profile_generation_started", profileLog);
          const result = await runDigestForProfile(profile, {
            localDate: dueState.localDate,
            deliveryTime: dueState.deliveryTime,
            runId,
            trigger: "schedule"
          });
          logBriefEvent("cron_profile_generation_completed", {
            ...profileLog,
            digestId: result.id,
            itemCount: result.itemCount,
            emailSent: Boolean(result.sentAt),
            emailError: result.emailError
          });
          results.push(result);
        } catch (error) {
          logBriefError("cron_profile_generation_failed", error, profileLog);
          throw error;
        }
      }

      logBriefEvent("cron_run_completed", {
        runId,
        resultCount: results.length,
        skippedCount: skipped.length
      });

      return NextResponse.json({ ok: true, results, skipped });
    }

    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logBriefEvent("manual_generation_started", {
      runId,
      userId: profile.userId,
      email: maskEmail(profile.email)
    });
    const result = await runDigestForProfile(profile, {
      runId,
      trigger: "manual"
    });
    logBriefEvent("manual_generation_completed", {
      runId,
      userId: profile.userId,
      email: maskEmail(profile.email),
      digestId: result.id,
      itemCount: result.itemCount,
      emailSent: Boolean(result.sentAt),
      emailError: result.emailError
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brief generation failed.";
    logBriefError("brief_run_failed", error, { runId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

async function findDigestForLocalDate(
  userId: string,
  localDate: string,
  deliveryTime: string
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digests")
    .select("id,subject,body_md,sent_at,created_at,item_count,digest_delivery_time")
    .eq("user_id", userId)
    .eq("digest_local_date", localDate)
    .eq("digest_delivery_time", deliveryTime)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingDigestScheduleColumn(error)) {
      return null;
    }

    throw error;
  }

  return data as (StoredDigestForEmail & {
    created_at: string;
    item_count: number;
  }) | null;
}

function isMissingDigestLocalDateColumn(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("digest_local_date") ||
    error.message?.includes("schema cache")
  );
}

function isMissingDigestScheduleColumn(error: {
  code?: string;
  message?: string;
}) {
  return (
    isMissingDigestLocalDateColumn(error) ||
    error.message?.includes("digest_delivery_time")
  );
}
