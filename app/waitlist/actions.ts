"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/profile";

export async function approveWaitlistRequest(formData: FormData) {
  await updateWaitlistAccess(formData, "approved");
}

export async function blockWaitlistRequest(formData: FormData) {
  await updateWaitlistAccess(formData, "blocked");
}

async function updateWaitlistAccess(
  formData: FormData,
  status: "approved" | "blocked"
) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isAdminEmail(profile.email)) {
    redirect("/dashboard");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/waitlist?type=error&message=Missing email.");
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error: accessError } = await admin.from("user_access").upsert({
    email,
    status,
    approved_at: status === "approved" ? now : null,
    approved_by: status === "approved" ? profile.userId : null,
    updated_at: now
  });

  if (accessError) {
    redirect(
      `/waitlist?type=error&message=${encodeURIComponent(accessError.message)}`
    );
  }

  const { error: waitlistError } = await admin
    .from("waitlist_requests")
    .update({
      status,
      updated_at: now
    })
    .eq("email", email);

  if (waitlistError) {
    redirect(
      `/waitlist?type=error&message=${encodeURIComponent(waitlistError.message)}`
    );
  }

  revalidatePath("/waitlist");
  redirect(
    `/waitlist?type=success&message=${encodeURIComponent(
      `${email} ${status === "approved" ? "approved" : "blocked"}.`
    )}`
  );
}
