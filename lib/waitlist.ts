import { createAdminClient } from "@/lib/supabase/admin";

export async function recordWaitlistRequest(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("waitlist_requests")
    .select("email,request_count")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (readError) {
    if (isMissingWaitlistTable(readError)) {
      return;
    }

    throw readError;
  }

  const now = new Date().toISOString();
  const { error } = existing
    ? await admin
        .from("waitlist_requests")
        .update({
          request_count: existing.request_count + 1,
          updated_at: now
        })
        .eq("email", normalizedEmail)
    : await admin.from("waitlist_requests").insert({
        email: normalizedEmail,
        source: "login",
        updated_at: now
      });

  if (error && !isMissingWaitlistTable(error)) {
    throw error;
  }
}

export function isMissingWaitlistTable(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("waitlist_requests") ||
    error.message?.includes("schema cache")
  );
}
