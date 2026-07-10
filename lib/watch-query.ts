import { generateObject } from "ai";
import { z } from "zod";
import { subagentModel } from "@/lib/ai-model";
import {
  normalizeWatchQuery,
  resolveWatchQueryQuality,
  watchQueries
} from "@/lib/watch-helpers";
import { validateXWatchQueries, type XPost } from "@/lib/x";

const queryVariantsSchema = z.object({
  queries: z.array(z.string()).min(1).max(3)
});

const queryQualitySchema = z.object({
  verdict: z.enum(["useful", "noisy", "too_narrow"]),
  explanation: z.string(),
  relevantPostIds: z.array(z.string()),
  revisedQueries: z.array(z.string()).max(3)
});

type PreparedWatchQueries = {
  query: string;
  queryCount: number;
  matchedPostCount: number;
  relevantPostCount: number;
  quality: "useful" | "too_narrow";
};

export async function compileWatchQueries(options: {
  title: string;
  objective: string;
  seedQuery: string;
}) {
  const { object } = await generateObject({
    model: subagentModel(),
    schema: queryVariantsSchema,
    system: [
      "Compile a natural-language X monitoring objective into one to three compact X Recent Search queries.",
      "Each query must stand alone, remain under 160 characters, and favor understandable keywords and exact phrases.",
      "Use exact technical phrases and small OR synonym groups to express concepts that X cannot understand semantically.",
      "Whitespace means AND. Do not produce long chains of bare words that all have to occur in one post.",
      "Disambiguate overloaded words such as agent, receipts, evidence, memory, state, and ledger with technical phrase anchors.",
      "Use uppercase OR sparingly. Avoid deeply nested Boolean groups and do not use explicit AND.",
      "Do not add user handles unless the objective explicitly names them.",
      "Do not add language or retweet filters; the application adds those."
    ].join("\n"),
    prompt: JSON.stringify(options, null, 2)
  });

  return normalizeWatchQuery(object.queries.join("\n"));
}

export async function prepareGeneratedWatchQueries(options: {
  title: string;
  objective: string;
  seedQuery: string;
}): Promise<PreparedWatchQueries> {
  let query = await compileWatchQueries(options);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await assessWatchQueries({
      title: options.title,
      objective: options.objective,
      query
    });

    if (result.verdict === "useful" || attempt === 2) {
      if (result.verdict === "noisy") {
        throw new Error(
          `X Analyst could not create sufficiently focused searches. ${result.explanation}`
        );
      }
      return toPreparedQueries(query, result);
    }

    if (!result.revisedQueries.length) {
      if (result.verdict === "too_narrow") {
        return toPreparedQueries(query, result);
      }
      throw new Error(
        `X Analyst could not refine this watch search. ${result.explanation}`
      );
    }

    query = normalizeWatchQuery(result.revisedQueries.join("\n"));
  }

  throw new Error("X Analyst could not prepare this watch search.");
}

export async function validateEditedWatchQueries(options: {
  title: string;
  objective: string;
  query: string;
}): Promise<PreparedWatchQueries> {
  const query = normalizeWatchQuery(options.query);
  const result = await assessWatchQueries({ ...options, query });
  if (result.verdict === "noisy") {
    const suggestion = result.revisedQueries.length
      ? ` Try: ${result.revisedQueries.join(" | ")}`
      : "";
    throw new Error(
      `These searches mostly returned posts unrelated to the watch. ${result.explanation}${suggestion}`
    );
  }
  return toPreparedQueries(query, result);
}

async function assessWatchQueries(options: {
  title: string;
  objective: string;
  query: string;
}) {
  const queries = watchQueries(options.query);
  const validation = await validateXWatchQueries(queries);
  if (validation.queries.length !== queries.length) {
    throw new Error(
      "One or more searches could not be accepted by X. Review them and try again."
    );
  }

  const suppliedPostIds = new Set(
    validation.samples.flatMap((sample) => sample.posts.map((post) => post.id))
  );
  const { object } = await generateObject({
    model: subagentModel(),
    schema: queryQualitySchema,
    system: [
      "You assess whether X Recent Search queries retrieve posts relevant to a focused monitoring objective.",
      "Judge retrieval precision, not whether a post is important enough for a daily brief.",
      "A post is relevant only when its meaning concerns the objective. Shared words with an unrelated meaning do not count.",
      "Classify as noisy when several sampled matches are lexical accidents, spam, scams, or unrelated uses of ambiguous words.",
      "Classify as too_narrow when there are no useful samples and the searches require an implausibly specific combination of terms.",
      "A quiet but well-formed technical search may be useful even when it has no current matches.",
      "For useful searches, revisedQueries must be empty.",
      "For noisy or too_narrow searches, propose one to three replacements using exact technical phrases and small OR synonym groups.",
      "Every revised query must stand alone, remain under 160 characters, and omit language and retweet filters.",
      "Only return relevantPostIds that appear in the supplied samples."
    ].join("\n"),
    prompt: JSON.stringify(
      {
        watch: { title: options.title, objective: options.objective },
        searches: validation.samples.map((sample) => ({
          query: sample.query,
          posts: sample.posts.slice(0, 10).map(samplePost)
        }))
      },
      null,
      2
    )
  });

  const relevantPostIds = object.relevantPostIds.filter((id) =>
    suppliedPostIds.has(id)
  );
  const verdict = resolveWatchQueryQuality(
    object.verdict,
    validation.matchedPostCount,
    relevantPostIds.length
  );
  return {
    verdict,
    explanation: object.explanation.trim(),
    relevantPostIds,
    revisedQueries: object.revisedQueries,
    matchedPostCount: validation.matchedPostCount
  };
}

function samplePost(post: XPost) {
  return {
    id: post.id,
    author: post.authorUsername ?? post.authorName ?? "",
    text: (post.longText || post.text).slice(0, 900)
  };
}

function toPreparedQueries(
  query: string,
  result: {
    verdict: "useful" | "noisy" | "too_narrow";
    relevantPostIds: string[];
    matchedPostCount: number;
  }
): PreparedWatchQueries {
  return {
    query,
    queryCount: watchQueries(query).length,
    matchedPostCount: result.matchedPostCount,
    relevantPostCount: result.relevantPostIds.length,
    quality: result.verdict === "too_narrow" ? "too_narrow" : "useful"
  };
}
