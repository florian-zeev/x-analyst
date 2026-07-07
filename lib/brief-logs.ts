export type BriefLogData = Record<string, unknown>;

export function logBriefEvent(event: string, data: BriefLogData = {}) {
  console.log("[x-analyst]", JSON.stringify({ event, ...data }));
}

export function logBriefError(
  event: string,
  error: unknown,
  data: BriefLogData = {}
) {
  console.error(
    "[x-analyst]",
    JSON.stringify({ event, ...data, error: errorToLogValue(error) })
  );
}

export function maskEmail(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const [name = "", domain = ""] = email.split("@");
  if (!domain) {
    return "***";
  }

  return `${name.slice(0, 2) || "*"}***@${domain}`;
}

function errorToLogValue(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return String(error);
}
