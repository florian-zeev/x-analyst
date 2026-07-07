export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAllowedEmail(email: string) {
  const allowlist = allowedEmails();

  if (allowlist.length > 0 && !allowlist.includes(email.toLowerCase())) {
    throw new Error("This email address is not allowed to use X Analyst.");
  }
}

export function isAllowedEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  const allowlist = allowedEmails();
  return allowlist.length === 0 || allowlist.includes(email.toLowerCase());
}

export function isAdminEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  return adminEmails().includes(email.toLowerCase());
}
