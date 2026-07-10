import { generateObject } from "ai";
import { z } from "zod";
import type { BriefingContext } from "@/lib/briefing-context";
import type { DigestItem } from "@/lib/digest";
import { subagentModel } from "@/lib/ai-model";
import type { FetchXPostsResult } from "@/lib/x";

const assessmentSchema = z.object({
  watchId: z.string(),
  status: z.enum(["quiet", "material"]),
  sourceUrl: z.string(),
  headline: z.string(),
  evidenceSummary: z.string(),
  takeaway: z.string(),
  tags: z.array(z.string()).max(4)
});

const assessmentsSchema = z.object({
  assessments: z.array(assessmentSchema)
});

export type WatchAssessment = z.infer<typeof assessmentSchema> & {
  matchedPostCount: number;
  errorMessage: string;
};

export async function evaluateWatches(options: {
  context: BriefingContext;
  items: DigestItem[];
  xResult: FetchXPostsResult;
}): Promise<WatchAssessment[]> {
  const { context, items, xResult } = options;
  if (!context.activeWatches.length) {
    return [];
  }

  const errors = new Map(
    xResult.watchErrors.map((error) => [error.watchId, error.message])
  );
  const successful = new Set(xResult.successfulWatchIds);
  const candidateCounts = new Map(
    context.activeWatches.map((watch) => [
      watch.id,
      items.filter((item) => item.post.watchIds.includes(watch.id)).length
    ])
  );
  const assessableWatches = context.activeWatches.filter(
    (watch) => successful.has(watch.id) && (candidateCounts.get(watch.id) ?? 0) > 0
  );

  let generated = new Map<string, z.infer<typeof assessmentSchema>>();
  if (assessableWatches.length) {
    try {
      const { object } = await generateObject({
        model: subagentModel(),
        schema: assessmentsSchema,
        system: [
          "You evaluate focused X watches independently from the daily brief editor.",
          "For every supplied watch, decide whether the retrieved evidence contains a genuinely material new development relative to the watch objective and recent checks.",
          "Material means the evidence changes the answer, adds concrete primary-source evidence, or reports a meaningful new launch, result, policy, capability, or failure.",
          "A merely relevant mention is quiet. Marketing repetition is quiet.",
          "Return exactly one assessment per watch id.",
          "For material assessments, sourceUrl must exactly match one supplied candidate URL and all explanatory fields must be complete.",
          "For quiet assessments, use an empty sourceUrl, headline, and takeaway plus an empty tags array. Set evidenceSummary to one concise sentence explaining why the retrieved evidence did not constitute a material change."
        ].join("\n"),
        prompt: JSON.stringify(
          {
            interestProfile: context.profile.interestProfileMd,
            recentChecks: context.recentWatchChecks,
            watches: assessableWatches.map((watch) => ({
              id: watch.id,
              title: watch.title,
              objective: watch.objective,
              candidates: items
                .filter((item) => item.post.watchIds.includes(watch.id))
                .slice(0, 8)
                .map((item) => ({
                  url: item.article.finalUrl,
                  title: item.article.title,
                  description: item.article.description,
                  excerpt: item.article.text.slice(0, 900),
                  author: item.post.authorUsername ?? item.post.authorName ?? ""
                }))
            }))
          },
          null,
          2
        )
      });
      generated = new Map(
        object.assessments.map((assessment) => [assessment.watchId, assessment])
      );
    } catch {
      return context.activeWatches.map((watch) => ({
        watchId: watch.id,
        status: "quiet",
        sourceUrl: "",
        headline: "",
        evidenceSummary: "",
        takeaway: "",
        tags: [],
        matchedPostCount: candidateCounts.get(watch.id) ?? 0,
        errorMessage: "Watch evaluation could not be completed."
      }));
    }
  }

  return context.activeWatches.map((watch) => {
    const matchedPostCount = candidateCounts.get(watch.id) ?? 0;
    const queryError = errors.get(watch.id);
    if (queryError || !successful.has(watch.id)) {
      return {
        watchId: watch.id,
        status: "quiet",
        sourceUrl: "",
        headline: "",
        evidenceSummary: "",
        takeaway: "",
        tags: [],
        matchedPostCount,
        errorMessage: queryError ?? "Watch search did not complete."
      };
    }

    const assessment = generated.get(watch.id);
    const validMaterialSource = items.some(
      (item) =>
        item.post.watchIds.includes(watch.id) &&
        item.article.finalUrl === assessment?.sourceUrl
    );
    if (assessment?.status === "material" && !validMaterialSource) {
      return {
        watchId: watch.id,
        status: "quiet",
        sourceUrl: "",
        headline: "",
        evidenceSummary: "",
        takeaway: "",
        tags: [],
        matchedPostCount,
        errorMessage: "Watch evaluation returned an invalid source."
      };
    }
    return {
      watchId: watch.id,
      status: assessment?.status ?? "quiet",
      sourceUrl: assessment?.sourceUrl ?? "",
      headline: assessment?.headline ?? "",
      evidenceSummary:
        assessment?.evidenceSummary ??
        (matchedPostCount > 0
          ? "Recent matches did not add a concrete new development."
          : "No relevant new posts were found in this check."),
      takeaway: assessment?.takeaway ?? "",
      tags: assessment?.tags ?? [],
      matchedPostCount,
      errorMessage: ""
    };
  });
}
