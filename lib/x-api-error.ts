export type XApiErrorDetails = {
  type: string | null;
  title: string | null;
  detail: string | null;
};

export function parseXApiErrorBody(body: string): XApiErrorDetails {
  if (!body.trim()) {
    return { type: null, title: null, detail: null };
  }

  try {
    const payload = JSON.parse(body) as {
      type?: unknown;
      title?: unknown;
      detail?: unknown;
      errors?: Array<{
        type?: unknown;
        title?: unknown;
        detail?: unknown;
        message?: unknown;
      }>;
    };
    const firstError = Array.isArray(payload.errors) ? payload.errors[0] : null;

    return {
      type: stringValue(payload.type) ?? stringValue(firstError?.type),
      title: stringValue(payload.title) ?? stringValue(firstError?.title),
      detail:
        stringValue(payload.detail) ??
        stringValue(firstError?.detail) ??
        stringValue(firstError?.message)
    };
  } catch {
    return {
      type: null,
      title: null,
      detail: body.trim().slice(0, 500) || null
    };
  }
}

export function publicXErrorMessage(status: number) {
  if (status === 400) {
    return "X could not understand one of the searches. Review its terms and quotation marks, then try again.";
  }
  if (status === 401 || status === 403) {
    return "X search access is not configured correctly.";
  }
  if (status === 429) {
    return "X is temporarily limiting search requests. Try again shortly.";
  }
  if (status >= 500) {
    return "X search is temporarily unavailable. Try again shortly.";
  }
  return "X could not complete this search.";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
