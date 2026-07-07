import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDigestForProfile } from "@/lib/digest";
import { getDeliveryDueState } from "@/lib/delivery-schedule";
import { getCurrentUserProfile, toProfile } from "@/lib/profile";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && auth === `Bearer ${cronSecret}`) {
      const admin = createAdminClient();
      const { data, error } = await admin.from("analyst_profiles").select("*");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const results = [];
      const skipped = [];
      for (const row of data ?? []) {
        const profile = toProfile(row);
        const dueState = getDeliveryDueState(profile);

        if (!dueState.due) {
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

        if (await hasDigestForLocalDate(profile.userId, dueState.localDate)) {
          skipped.push({
            email: profile.email,
            reason: "already_sent",
            localDate: dueState.localDate,
            deliveryTime: profile.deliveryTime,
            timezone: profile.deliveryTimezone
          });
          continue;
        }

        results.push(
          await runDigestForProfile(profile, { localDate: dueState.localDate })
        );
      }

      return NextResponse.json({ ok: true, results, skipped });
    }

    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runDigestForProfile(profile);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brief generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

async function hasDigestForLocalDate(userId: string, localDate: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digests")
    .select("id")
    .eq("user_id", userId)
    .eq("digest_local_date", localDate)
    .limit(1);

  if (error) {
    if (isMissingDigestLocalDateColumn(error)) {
      return false;
    }

    throw error;
  }

  return Boolean(data?.length);
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
