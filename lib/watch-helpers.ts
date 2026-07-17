export const ACTIVE_WATCH_LIMIT = 5;
export const MAX_WATCH_QUERY_LENGTH = 480;
export const MAX_WATCH_QUERY_VARIANTS = 3;
export const MAX_WATCH_QUERY_VARIANT_LENGTH = 160;

export function normalizeWatchQuery(value: string) {
  const queries = watchQueries(value);
  const normalized = queries.join("\n");

  if (!normalized) {
    throw new Error("Watch query cannot be empty.");
  }

  if (normalized.length > MAX_WATCH_QUERY_LENGTH) {
    throw new Error(
      `Watch query must be ${MAX_WATCH_QUERY_LENGTH} characters or fewer.`
    );
  }

  if (queries.length > MAX_WATCH_QUERY_VARIANTS) {
    throw new Error(`A watch can use at most ${MAX_WATCH_QUERY_VARIANTS} searches.`);
  }
  if (queries.some((query) => query.length > MAX_WATCH_QUERY_VARIANT_LENGTH)) {
    throw new Error(
      `Each watch search must be ${MAX_WATCH_QUERY_VARIANT_LENGTH} characters or fewer.`
    );
  }

  return normalized;
}

export function watchQueries(value: string) {
  return value
    .split(/\r?\n/)
    .map((query) =>
      query
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

export function watchCoversFollowup(
  watch: { title: string; objective: string },
  followup: { watchTitle: string; watchObjective: string }
) {
  return (
    normalizeCoverageText(watch.title) ===
      normalizeCoverageText(followup.watchTitle) &&
    normalizeCoverageText(watch.objective) ===
      normalizeCoverageText(followup.watchObjective)
  );
}

export function resolveWatchQueryQuality(
  verdict: "useful" | "noisy" | "too_narrow",
  matchedPostCount: number,
  relevantPostCount: number
) {
  if (matchedPostCount >= 3 && relevantPostCount === 0) {
    return "noisy" as const;
  }
  return verdict;
}

function normalizeCoverageText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
