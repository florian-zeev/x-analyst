import { NextResponse, type NextRequest } from "next/server";
import { parseStructuredBrief } from "@/lib/brief";
import { storeDigestItemsForBrief } from "@/lib/digest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: digests, error: digestError } = await admin
    .from("digests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (digestError) {
    return NextResponse.json({ error: digestError.message }, { status: 500 });
  }

  const digestIds = (digests ?? []).map((digest) => digest.id);
  const existingDigestIds = new Set<string>();

  if (digestIds.length) {
    const { data: existing, error: existingError } = await admin
      .from("digest_items")
      .select("digest_id")
      .in("digest_id", digestIds);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    for (const row of existing ?? []) {
      existingDigestIds.add(row.digest_id);
    }
  }

  let backfilled = 0;
  let skipped = 0;

  for (const digest of digests ?? []) {
    if (existingDigestIds.has(digest.id)) {
      skipped += 1;
      continue;
    }

    const structured = parseStructuredBrief(digest.body_md);
    if (!structured) {
      skipped += 1;
      continue;
    }

    await storeDigestItemsForBrief({
      digestId: digest.id,
      userId: digest.user_id,
      subject: digest.subject,
      createdAt: digest.created_at,
      brief: structured.brief
    });
    backfilled += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: digests?.length ?? 0,
    backfilled,
    skipped
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
