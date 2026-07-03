import { createAdminClient } from "@/lib/supabase/admin";

export type LearningContext = {
  summary: string;
  moreTags: string[];
  lessTags: string[];
  moreSources: string[];
  lessSources: string[];
  examples: string[];
};

export async function getLearningContext(userId: string): Promise<LearningContext> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("article_feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return emptyLearningContext(
        "No learning feedback table found yet. Run the article_feedback migration."
      );
    }
    throw error;
  }

  if (!data?.length) {
    return emptyLearningContext("No explicit article feedback recorded yet.");
  }

  const more = data.filter((item) => item.direction === "more");
  const less = data.filter((item) => item.direction === "less");
  const moreTags = topValues(more.flatMap((item) => item.tags));
  const lessTags = topValues(less.flatMap((item) => item.tags));
  const moreSources = topValues(more.map((item) => item.source_label));
  const lessSources = topValues(less.map((item) => item.source_label));
  const examples = data.slice(0, 12).map((item) =>
    [
      `${item.direction.toUpperCase()}: ${item.item_title}`,
      `Source: ${item.source_label}`,
      item.via_handle ? `Via: ${item.via_handle}` : "",
      item.tags.length ? `Tags: ${item.tags.join(", ")}` : "",
      item.reason ? `Reason: ${item.reason}` : "",
      item.note ? `Note: ${item.note}` : ""
    ]
      .filter(Boolean)
      .join(" | ")
  );

  return {
    summary: [
      `${more.length} more-like-this signals, ${less.length} less-like-this signals.`,
      moreTags.length ? `Prefer tags: ${moreTags.join(", ")}.` : "",
      lessTags.length ? `Down-rank tags: ${lessTags.join(", ")}.` : "",
      moreSources.length ? `Prefer sources: ${moreSources.join(", ")}.` : "",
      lessSources.length ? `Down-rank sources: ${lessSources.join(", ")}.` : ""
    ]
      .filter(Boolean)
      .join(" "),
    moreTags,
    lessTags,
    moreSources,
    lessSources,
    examples
  };
}

function emptyLearningContext(summary: string): LearningContext {
  return {
    summary,
    moreTags: [],
    lessTags: [],
    moreSources: [],
    lessSources: [],
    examples: []
  };
}

function topValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([value]) => value);
}
