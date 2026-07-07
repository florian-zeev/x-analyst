import { allowedEmails, isAdminEmail } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export async function canAccessEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.toLowerCase();
  if (
    allowedEmails().includes(normalizedEmail) ||
    isAdminEmail(normalizedEmail)
  ) {
    return true;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_access")
    .select("status")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    if (isMissingUserAccessTable(error)) {
      return false;
    }

    throw error;
  }

  return data?.status === "approved";
}

export function isMissingUserAccessTable(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("user_access") ||
    error.message?.includes("schema cache")
  );
}
