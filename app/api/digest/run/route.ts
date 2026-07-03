import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDigestForProfile } from "@/lib/digest";
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
      for (const row of data ?? []) {
        results.push(await runDigestForProfile(toProfile(row)));
      }

      return NextResponse.json({ ok: true, results });
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
