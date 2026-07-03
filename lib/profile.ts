import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/authz";

export type AnalystProfile = {
  userId: string;
  email: string;
  interestProfileMd: string;
  xListId: string | null;
  discoveryQueries: string[];
  priorityHandles: string[];
  digestEmail: string | null;
};

const defaultInterestProfile = "";

export const getCurrentUserProfile = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  const email = String(data.claims.email ?? "").toLowerCase();

  if (!isAllowedEmail(email)) {
    return null;
  }

  const admin = createAdminClient();
  const userId = data.claims.sub;
  const { data: row, error: profileError } = await admin
    .from("analyst_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!row) {
    const { data: inserted, error: insertError } = await admin
      .from("analyst_profiles")
      .insert({
        user_id: userId,
        email,
        interest_profile_md: defaultInterestProfile,
        discovery_queries: [],
        priority_handles: [],
        digest_email: email
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return toProfile(inserted);
  }

  return toProfile(row);
});

export function toProfile(row: {
  user_id: string;
  email: string;
  interest_profile_md: string;
  x_list_id: string | null;
  discovery_queries: string[];
  priority_handles: string[];
  digest_email: string | null;
}): AnalystProfile {
  return {
    userId: row.user_id,
    email: row.email,
    interestProfileMd: row.interest_profile_md,
    xListId: row.x_list_id,
    discoveryQueries: row.discovery_queries,
    priorityHandles: row.priority_handles ?? [],
    digestEmail: row.digest_email
  };
}
