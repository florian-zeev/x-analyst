import { generateObject } from "ai";
import { Client } from "eve/client";
import {
  type DailyBrief,
  type GeneratedDailyBrief,
  encodeStructuredBrief,
  generatedDailyBriefSchema,
  parseStructuredBrief,
  structuredBriefToHtml,
  structuredBriefToMarkdown,
  type WatchRun,
  type WatchRunCheck
} from "@/lib/brief";
import {
  getBriefingContext,
  type BriefingContext
} from "@/lib/briefing-context";
import { fetchArticle, type ArticleSnapshot } from "@/lib/article";
import { sendDigestEmail } from "@/lib/email";
import { type AnalystProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchXPosts,
  type XPost
} from "@/lib/x";
import {
  canCreateCollectionSaveLinks,
  createCollectionSaveToken
} from "@/lib/collection-token";
import { logBriefError, logBriefEvent, maskEmail } from "@/lib/brief-logs";
import { briefingModel } from "@/lib/ai-model";
import {
  finalizeWatchChecks,
  type Watch
} from "@/lib/watches";
import { watchCoversFollowup, watchQueries } from "@/lib/watch-helpers";
import {
  evaluateWatches,
  type WatchAssessment
} from "@/lib/watch-evaluation";

const FALLBACK_CANDIDATE_LIMIT = 30;
const BRIEF_ITEM_LIMIT = 10;
const EVE_WORKFLOW_TIMEOUT_MS = 120_000;

export type DigestItem = {
  post: XPost;
  article: ArticleSnapshot;
  kind: "x" | "link";
};

export type RunDigestOptions = {
  localDate?: string | null;
  deliveryTime?: string | null;
  runId?: string;
  trigger?: "manual" | "schedule";
  activeWatches?: Watch[];
};

export type StoredDigestForEmail = {
  id: string;
  subject: string;
  body_md: string;
  sent_at: string | null;
  digest_delivery_time?: string | null;
  watch_state_finalized_at?: string | null;
};

type StoredDocumentRef = {
  url: string;
  final_url: string;
  title: string;
  content_title: string;
  content_description: string;
};

export async function runDigestForProfile(
  profile: AnalystProfile,
  options: RunDigestOptions = {}
) {
  const runId = options.runId ?? crypto.randomUUID();
  const logContext = {
    runId,
    trigger: options.trigger ?? "manual",
    userId: profile.userId,
    email: maskEmail(profile.email),
    localDate: options.localDate ?? null,
    deliveryTime: options.deliveryTime ?? null
  };

  logBriefEvent("brief_generation_started", {
    ...logContext,
    hasXList: Boolean(profile.xListId),
    discoveryQueryCount: profile.discoveryQueries.length,
    priorityHandleCount: profile.priorityHandles.length
  });

  const context = await getBriefingContext(profile, options.activeWatches);
  const xResult = await fetchXPosts({
    listId: profile.xListId,
    discoveryQueries: profile.discoveryQueries,
    watches: context.activeWatches.map((watch) => ({
      id: watch.id,
      queries: watchQueries(watch.x_query)
    }))
  });
  logBriefEvent("brief_posts_fetched", {
    ...logContext,
    postCount: xResult.posts.length,
    activeWatchCount: context.activeWatches.length,
    watchErrorCount: xResult.watchErrors.length,
    sourceCounts: xResult.sourceCounts
  });

  const storedDocuments = await getStoredDocumentRefs(profile.userId);
  const rejectedUrls = await getRejectedUrls(profile.userId);
  logBriefEvent("brief_memory_loaded", {
    ...logContext,
    storedDocumentCount: storedDocuments.length,
    rejectedUrlCount: rejectedUrls.size
  });

  const collectedItems = await collectArticles(xResult.posts, storedDocuments);
  const items = filterRejectedItems(collectedItems, rejectedUrls);
  logBriefEvent("brief_candidates_collected", {
    ...logContext,
    collectedItemCount: collectedItems.length,
    candidateItemCount: items.length,
    filteredRejectedCount: collectedItems.length - items.length
  });

  const [generatedBrief, watchAssessments] = await Promise.all([
    writeBriefWithEveFallback(context, items, logContext),
    evaluateWatches({ context, items, xResult })
  ]);
  const { brief, watchRun } = enrichBrief({
    generatedBrief,
    items,
    context,
    watchAssessments
  });
  const briefItemCount = countBriefItems(brief);
  logBriefEvent("brief_written", {
    ...logContext,
    sectionCount: brief.sections.length,
    itemCount: briefItemCount
  });

  const body = encodeStructuredBrief(brief, watchRun);
  const subject = `X Analyst Brief - ${new Date().toISOString().slice(0, 10)}`;

  const admin = createAdminClient();
  const { data: digest, error } = await admin
    .from("digests")
    .insert({
      user_id: profile.userId,
      subject,
      body_md: body,
      item_count: briefItemCount,
      digest_local_date: options.localDate ?? null,
      digest_delivery_time: options.deliveryTime ?? null
    })
    .select("*")
    .single();

  if (error) {
    logBriefError("brief_insert_failed", error, logContext);
    throw error;
  }

  logBriefEvent("brief_inserted", {
    ...logContext,
    digestId: digest.id,
    itemCount: briefItemCount
  });

  const storedItemIds = await storeDigestItemsForBrief({
    digestId: digest.id,
    userId: profile.userId,
    subject,
    createdAt: digest.created_at,
    brief,
    sourceItems: items
  });
  logBriefEvent("brief_items_stored", {
    ...logContext,
    digestId: digest.id,
    itemCount: briefItemCount
  });

  if (watchRun.checks.length) {
    await finalizeWatchChecks({
      userId: profile.userId,
      digestId: digest.id,
      checks: watchRun.checks.map((check) => ({
        ...check,
        digestItemId: storedItemIds.get(normalizeUrl(check.sourceUrl)) ?? null
      }))
    });
    logBriefEvent("brief_watch_checks_finalized", {
      ...logContext,
      digestId: digest.id,
      checkCount: watchRun.checks.length,
      materialCount: watchRun.checks.filter(
        (check) => check.status === "material"
      ).length,
      errorCount: watchRun.checks.filter((check) => check.status === "error")
        .length
    });
  }

  const deliveryEmail = profile.digestEmail ?? profile.email;
  let sentAt: string | null = null;
  let emailError: string | null = null;
  if (deliveryEmail && briefItemCount > 0) {
    try {
      logBriefEvent("brief_email_send_started", {
        ...logContext,
        digestId: digest.id,
        deliveryEmail: maskEmail(deliveryEmail)
      });
      const result = await sendDigestEmail({
        to: deliveryEmail,
        subject,
        markdown: structuredBriefToMarkdown(brief, watchRun),
        html: structuredBriefToHtml(brief, {
          watchRun,
          saveUrlForItem: canCreateCollectionSaveLinks()
            ? (item) => collectionSaveUrl(profile.userId, digest.id, item.url)
            : undefined,
          followupUrl: (followup) => followupBriefUrl(digest.id, followup.id)
        })
      });

      if (result.sent) {
        sentAt = new Date().toISOString();
        await admin
          .from("digests")
          .update({ sent_at: sentAt })
          .eq("id", digest.id);
      }
      logBriefEvent("brief_email_send_completed", {
        ...logContext,
        digestId: digest.id,
        deliveryEmail: maskEmail(deliveryEmail),
        sent: result.sent,
        sentAt
      });
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Email failed.";
      logBriefError("brief_email_send_failed", error, {
        ...logContext,
        digestId: digest.id,
        deliveryEmail: maskEmail(deliveryEmail)
      });
    }
  } else if (briefItemCount === 0) {
    logBriefEvent("brief_email_skipped_empty", {
      ...logContext,
      digestId: digest.id,
      deliveryEmail: maskEmail(deliveryEmail)
    });
  }

  logBriefEvent("brief_generation_completed", {
    ...logContext,
    digestId: digest.id,
    itemCount: briefItemCount,
    emailError
  });

  return {
    id: digest.id,
    subject,
    body,
    itemCount: briefItemCount,
    sentAt,
    emailError
  };
}

export async function sendStoredDigestEmail(
  profile: AnalystProfile,
  digest: StoredDigestForEmail,
  options: RunDigestOptions = {}
) {
  const deliveryEmail = profile.digestEmail ?? profile.email;
  const runId = options.runId ?? crypto.randomUUID();
  const logContext = {
    runId,
    trigger: options.trigger ?? "schedule",
    userId: profile.userId,
    email: maskEmail(profile.email),
    digestId: digest.id,
    deliveryEmail: maskEmail(deliveryEmail),
    localDate: options.localDate ?? null,
    deliveryTime: options.deliveryTime ?? digest.digest_delivery_time ?? null
  };

  if (!deliveryEmail) {
    return {
      id: digest.id,
      subject: digest.subject,
      sentAt: null,
      emailError: "No delivery email configured."
    };
  }

  const structured = parseStructuredBrief(digest.body_md);
  if (!structured) {
    return {
      id: digest.id,
      subject: digest.subject,
      sentAt: null,
      emailError: "Stored brief is not structured; cannot retry styled email."
    };
  }

  try {
    if (
      !digest.watch_state_finalized_at &&
      structured.watchRun.checks.length > 0
    ) {
      const itemIds = await getStoredDigestItemIds(digest.id, profile.userId);
      await finalizeWatchChecks({
        userId: profile.userId,
        digestId: digest.id,
        checks: structured.watchRun.checks.map((check) => ({
          ...check,
          digestItemId: itemIds.get(normalizeUrl(check.sourceUrl)) ?? null
        }))
      });
      logBriefEvent("stored_brief_watch_checks_repaired", {
        ...logContext,
        checkCount: structured.watchRun.checks.length
      });
    }

    logBriefEvent("stored_brief_email_retry_started", logContext);
    const result = await sendDigestEmail({
      to: deliveryEmail,
      subject: digest.subject,
      markdown: structuredBriefToMarkdown(
        structured.brief,
        structured.watchRun
      ),
      html: structuredBriefToHtml(structured.brief, {
        watchRun: structured.watchRun,
        saveUrlForItem: canCreateCollectionSaveLinks()
          ? (item) => collectionSaveUrl(profile.userId, digest.id, item.url)
          : undefined,
        followupUrl: (followup) => followupBriefUrl(digest.id, followup.id)
      })
    });

    let sentAt: string | null = null;
    if (result.sent) {
      sentAt = new Date().toISOString();
      const admin = createAdminClient();
      await admin.from("digests").update({ sent_at: sentAt }).eq("id", digest.id);
    }

    logBriefEvent("stored_brief_email_retry_completed", {
      ...logContext,
      sent: result.sent,
      sentAt
    });

    return {
      id: digest.id,
      subject: digest.subject,
      sentAt,
      emailError: null
    };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "Email failed.";
    logBriefError("stored_brief_email_retry_failed", error, logContext);
    return {
      id: digest.id,
      subject: digest.subject,
      sentAt: null,
      emailError
    };
  }
}

export async function storeDigestItemsForBrief({
  digestId,
  userId,
  subject,
  createdAt,
  brief,
  sourceItems = []
}: {
  digestId: string;
  userId: string;
  subject: string;
  createdAt: string;
  brief: DailyBrief;
  sourceItems?: DigestItem[];
}) {
  const rows = brief.sections.flatMap((section) =>
    section.items.map((item) => {
      const sourceItem = findSourceItem(item.url, sourceItems);

      return {
        digest_id: digestId,
        user_id: userId,
        digest_subject: subject,
        digest_created_at: createdAt,
        section_title: section.title,
        title: item.title,
        source_label: item.sourceLabel,
        url: item.url,
        via_handle: item.viaHandle,
        via_url: item.viaUrl,
        source_type: item.sourceType,
        why: item.why,
        takeaway: item.takeaway,
        tags: item.tags,
        final_url: sourceItem?.article.finalUrl ?? item.url,
        content_title: sourceItem?.article.title ?? item.title,
        content_description: sourceItem?.article.description ?? "",
        content_text: sourceItem?.article.text ?? ""
      };
    })
  );

  if (!rows.length) {
    return new Map<string, string>();
  }

  const admin = createAdminClient();
  const { error } = await admin.from("digest_items").upsert(rows, {
    ignoreDuplicates: true,
    onConflict: "digest_id,section_title,url,title"
  });

  if (error) {
    if (isMissingDigestSnapshotColumns(error)) {
      const fallbackRows = rows.map(
        ({
          final_url,
          content_title,
          content_description,
          content_text,
          ...row
        }) => row
      );
      const { error: fallbackError } = await admin
        .from("digest_items")
        .upsert(fallbackRows, {
          ignoreDuplicates: true,
          onConflict: "digest_id,section_title,url,title"
        });

      if (!fallbackError) {
        return getStoredDigestItemIds(digestId, userId);
      }
    }

    throw error;
  }

  return getStoredDigestItemIds(digestId, userId);
}

async function getStoredDigestItemIds(digestId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digest_items")
    .select("id,url")
    .eq("digest_id", digestId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((item) => [normalizeUrl(item.url), item.id] as const)
  );
}

function collectionSaveUrl(userId: string, digestId: string, url: string) {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }

  const token = createCollectionSaveToken({
    userId,
    digestId,
    url
  });

  return `${baseUrl.replace(/\/$/, "")}/collection/save?token=${encodeURIComponent(
    token
  )}`;
}

function followupBriefUrl(digestId: string, followupId: string) {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, "")}/briefs/${digestId}#followup-${encodeURIComponent(
    followupId
  )}`;
}

async function collectArticles(
  posts: XPost[],
  storedDocuments: StoredDocumentRef[]
) {
  const seen = createDocumentMemory(storedDocuments);
  const candidates: DigestItem[] = [];

  for (const post of posts.slice(0, 80)) {
    let addedLinkedItem = false;

    for (const url of post.urls.slice(0, 2)) {
      if (isLowValueUrl(url) || seen.hasUrl(url)) {
        continue;
      }

      const article = await fetchArticle(url);
      if (seen.hasArticle(article)) {
        continue;
      }

      seen.addArticle(article);
      candidates.push({ post, article, kind: "link" });
      addedLinkedItem = true;
    }

    if (!addedLinkedItem && isSubstantialXPost(post)) {
      const url = xPostUrl(post);
      const article = {
        url,
        finalUrl: url,
        title: `X post by ${formatAuthor(post)}`,
        description: post.longText ?? post.text,
        text: post.longText ?? post.text,
        fetched: true
      };

      if (!seen.hasArticle(article)) {
        seen.addArticle(article);
        candidates.push({ post, kind: "x", article });
      }
    }
  }

  return candidates.slice(0, 50);
}

async function getStoredDocumentRefs(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digest_items")
    .select("url,final_url,title,content_title,content_description")
    .eq("user_id", userId)
    .order("digest_created_at", { ascending: false })
    .limit(5000);

  if (error) {
    if (isMissingDigestSnapshotColumns(error)) {
      const { data: fallbackData, error: fallbackError } = await admin
        .from("digest_items")
        .select("url,title")
        .eq("user_id", userId)
        .order("digest_created_at", { ascending: false })
        .limit(5000);

      if (fallbackError) {
        throw fallbackError;
      }

      return (fallbackData ?? []).map((item) => ({
        url: item.url,
        final_url: "",
        title: item.title,
        content_title: "",
        content_description: ""
      }));
    }

    throw error;
  }

  return data ?? [];
}

async function getRejectedUrls(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("digest_items")
    .select("url")
    .eq("user_id", userId)
    .not("rejected_at", "is", null);

  if (error) {
    if (isMissingRejectedColumn(error)) {
      return new Set<string>();
    }

    throw error;
  }

  return new Set((data ?? []).map((item) => normalizeUrl(item.url)));
}

function filterRejectedItems(items: DigestItem[], rejectedUrls: Set<string>) {
  if (!rejectedUrls.size) {
    return items;
  }

  return items.filter(
    (item) =>
      !rejectedUrls.has(normalizeUrl(item.article.finalUrl)) &&
      !rejectedUrls.has(normalizeUrl(item.article.url))
  );
}

async function writeBrief(context: BriefingContext, items: DigestItem[]) {
  const { profile, learning } = context;
  if (items.length === 0) {
    return {
      title: "Daily Brief" as const,
      bluf:
        "No strong linked articles, X-native long posts, or profile-relevant developments were found in the configured sources today.",
      generatedFor: profile.email,
      sections: [
        {
          id: "quiet-feed",
          title: "Quiet Feed",
          summary:
            "Check the X list ID, discovery queries, and X API access if this looks unexpectedly quiet.",
          items: []
        }
      ],
      followups: []
    } satisfies GeneratedDailyBrief;
  }

  const sourcePack = formatSourcePack(context, items);

  const { object } = await generateObject({
    model: briefingModel(),
    schema: generatedDailyBriefSchema,
    system: [
      "You are a senior analyst writing a daily brief for the domain described by the reader's interest profile.",
      "Rank ruthlessly against the reader's stated interests.",
      "Prefer primary sources, new substantive depth, concrete developments, and signals that materially change understanding of the domain.",
      "Do not include filler. Include source links for every item you mention.",
      "Return compact structured data for a UI. Never put raw long URLs in prose; put the full target only in the url field.",
      "Use sourceLabel for the visible label, such as the host, article title, organization, publication, project, topic, or X handle."
    ].join(" "),
    prompt: [
      "Reader interest profile:",
      profile.interestProfileMd,
      "",
      "Explicit learning feedback:",
      learning.summary,
      learning.examples.length ? learning.examples.join("\n") : "No examples yet.",
      "",
      "Candidate items from X, including X-native long posts/articles and linked articles:",
      sourcePack,
      "",
      "Priority X handles:",
      profile.priorityHandles.length
        ? profile.priorityHandles.map((handle) => `@${handle}`).join(", ")
        : "None configured",
      "",
      "Active X watches:",
      formatWatchContext(context),
      "",
      "If an item comes from a priority handle, treat that as a signal to inspect it more carefully and consider elevating it when the substance matches the reader profile. Do not include it solely because of the handle.",
      "Diversity is part of quality. Avoid multiple items that say the same thing from the same handle, organization, publication, project, person, or topic cluster.",
      "If a priority handle posts a thread or several related updates about the same announcement, choose the single most canonical or information-rich post and summarize the cluster once.",
      "Do not include more than two items from the same priority handle in the priority-source section unless they are clearly unrelated stories.",
      "Prefer a varied brief across authors, sources, organizations, developments, debates, research, evidence, and signals over exhaustive coverage of one source.",
      `Include no more than ${BRIEF_ITEM_LIMIT} items total across all sections.`,
      "",
      "Create a concise structured brief with title exactly: Daily Brief.",
      "",
      "Use section titles that fit the reader's domain. These are acceptable defaults when relevant:",
      "Must Read",
      "Priority Sources",
      "New Developments",
      "Deep Reads",
      "Signals",
      "X-Native Reads",
      "Interesting But Lower Priority",
      "Focus Tracker Updates",
      "",
      "Use Priority Sources for substantive items from configured priority X handles. That section must only contain items whose Priority author field is yes.",
      "Each item must have title, sourceLabel, url, viaHandle, viaUrl, sourceType, why, takeaway, and tags.",
      "Set viaHandle and viaUrl to empty strings; the application will attach exact X provenance after generation.",
      "Do not assign numeric ratings. They create false precision. Rank through section placement and concise prose instead.",
      "When citing X-native items, url must link to the X post and why must describe why the post itself is worth reading.",
      "Do not create a Focus Tracker Updates section. A separate focus-tracker evaluator adds independently assessed results.",
      "Generate at most three suggested follow-ups. Every follow-up must include title, description, watchTitle, watchObjective, xQuery, and targetWatchId.",
      "If an active watch already covers the follow-up, set targetWatchId to its exact id. Otherwise set targetWatchId to null.",
      "Follow-ups must be focused X monitoring questions. Do not propose handles, account timelines, or independent web monitoring.",
      "For xQuery, return one to three short X searches separated by newline characters. Keep each search understandable and under 160 characters. Avoid deeply nested Boolean expressions."
    ].join("\n")
  });

  return dedupeBriefItems(diversifyBrief(attachTweetProvenance(object, items)));
}

async function writeBriefWithEve(
  context: BriefingContext,
  items: DigestItem[]
) {
  const { profile, learning } = context;
  if (items.length === 0) {
    return writeBrief(context, items);
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("DIGEST_GENERATION_MODE=eve requires CRON_SECRET.");
  }

  const client = new Client({
    host: resolveEveHost(),
    auth: {
      bearer: cronSecret
    }
  });
  const session = client.session();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    EVE_WORKFLOW_TIMEOUT_MS
  );
  let result;

  try {
    const response = await session.send<GeneratedDailyBrief>({
      outputSchema: generatedDailyBriefSchema,
      signal: controller.signal,
      message: [
      "Generate the production X Analyst daily brief using the staged subagent workflow.",
      "",
      "You must use the reader profile and learning context below as the briefing contract.",
      "You must delegate substantive work to the specialist subagents. Use Workflow when useful to run candidate_scout, article_reader, cluster_analyst, and brief_editor in a staged flow.",
      "Do not call run_x_analyst_digest. The API route already collected candidates and will store/email the result.",
      "Return only structured data matching the requested DailyBrief schema.",
      "",
      "Reader context:",
      JSON.stringify(
        {
          userId: profile.userId,
          email: profile.email,
          interestProfileMd: profile.interestProfileMd,
          priorityHandles: profile.priorityHandles,
          discoveryQueries: profile.discoveryQueries,
          learning,
          activeWatches: context.activeWatches.map((watch) => ({
            id: watch.id,
            title: watch.title,
            objective: watch.objective,
            xQuery: watch.x_query
          })),
          recentWatchChecks: context.recentWatchChecks
        },
        null,
        2
      ),
      "",
      "Candidate items from X, including X-native long posts/articles and linked articles:",
      formatSourcePack(context, items),
      "",
      "Editorial requirements:",
      "- Title must be exactly Daily Brief.",
      "- Prefer fewer, higher-signal items.",
      `- Include no more than ${BRIEF_ITEM_LIMIT} items total across all sections.`,
      "- Avoid duplicates and near-duplicates.",
      "- Use Priority Sources only for substantive items from configured priority handles.",
      "- Do not assign numeric ratings.",
      "- For X-native items, url must point to the X post itself.",
      "- Set viaHandle and viaUrl to empty strings; the app attaches exact X provenance after generation.",
      "- Do not create a Focus Tracker Updates section. A separate focus-tracker evaluator adds independently assessed results.",
      "- Generate at most three focused X-only follow-ups with every schema field supplied.",
      "- If an active watch already covers a follow-up, use its exact id as targetWatchId; otherwise use null.",
      "- Never propose handles, account timelines, or independent web monitoring.",
      "- For xQuery, return one to three short X searches separated by newline characters. Keep each under 160 characters and avoid deeply nested Boolean expressions."
      ].join("\n")
    });

    result = await response.result();
  } finally {
    clearTimeout(timeout);
    // Eve's session endpoint remains open after a turn boundary. Abort the
    // consumed stream so Next does not wait for its fetch-cache clone.
    controller.abort();
  }

  if (result.status !== "completed" || !result.data) {
    const eventTypes = result.events.map((event) => event.type).join(", ");
    throw new Error(
      `Eve brief workflow failed with status ${result.status}: ${
        result.message || "No structured result."
      }${eventTypes ? ` Events: ${eventTypes}` : ""}`
    );
  }

  return dedupeBriefItems(
    diversifyBrief(
      attachTweetProvenance(generatedDailyBriefSchema.parse(result.data), items)
    )
  );
}

async function writeBriefWithEveFallback(
  context: BriefingContext,
  items: DigestItem[],
  logContext: Record<string, unknown>
) {
  try {
    logBriefEvent("brief_eve_workflow_started", {
      ...logContext,
      candidateItemCount: items.length
    });
    const brief = await writeBriefWithEve(context, items);
    logBriefEvent("brief_eve_workflow_completed", {
      ...logContext,
      sectionCount: brief.sections.length,
      itemCount: countBriefItems(brief)
    });
    return brief;
  } catch (error) {
    logBriefError("brief_eve_workflow_failed_fallback_started", error, {
      ...logContext,
      candidateItemCount: items.length
    });
    const brief = await writeBrief(
      context,
      selectFallbackCandidates(items, FALLBACK_CANDIDATE_LIMIT)
    );
    logBriefEvent("brief_direct_writer_completed_after_eve_fallback", {
      ...logContext,
      sectionCount: brief.sections.length,
      itemCount: countBriefItems(brief)
    });
    return brief;
  }
}

function formatSourcePack(context: BriefingContext, items: DigestItem[]) {
  const { profile } = context;
  const watches = new Map(
    context.activeWatches.map((watch) => [watch.id, watch] as const)
  );
  return items
    .map((item, index) =>
      [
        `ITEM ${index + 1}`,
        `Kind: ${item.kind === "x" ? "X-native post/article" : "External link"}`,
        `X text: ${item.post.longText ?? item.post.text}`,
        `Author: ${formatAuthor(item.post)}`,
        `Priority author: ${isPriorityAuthor(item.post, profile.priorityHandles) ? "yes" : "no"}`,
        `Source: ${item.post.source}`,
        `Matching watches: ${
          item.post.watchIds.length
            ? item.post.watchIds
                .map((id) => {
                  const watch = watches.get(id);
                  return watch ? `${watch.title} (${watch.id})` : id;
                })
                .join(", ")
            : "none"
        }`,
        `URL: ${item.article.finalUrl}`,
        `Host: ${hostLabel(item.article.finalUrl)}`,
        `Title: ${item.article.title}`,
        `Description: ${item.article.description}`,
        `Article excerpt: ${item.article.text.slice(0, 1200)}`
      ].join("\n")
    )
    .join("\n\n---\n\n");
}

function formatWatchContext(context: BriefingContext) {
  if (!context.activeWatches.length) {
    return "None configured";
  }

  return context.activeWatches
    .map(
      (watch) =>
        `- ${watch.title} (${watch.id}): ${watch.objective} | X query: ${watch.x_query}`
    )
    .join("\n");
}

function resolveEveHost() {
  return (
    process.env.EVE_AGENT_HOST ??
    process.env.APP_BASE_URL ??
    "http://localhost:3000"
  );
}

function attachTweetProvenance(
  brief: GeneratedDailyBrief,
  items: DigestItem[]
) {
  return {
    ...brief,
    sections: brief.sections.map((section) => ({
      ...section,
      items: section.items.map((briefItem) => {
        const sourceItem = findSourceItem(briefItem.url, items);
        return {
          ...briefItem,
          viaHandle: sourceItem?.post.authorUsername
            ? `@${sourceItem.post.authorUsername}`
            : "",
          viaUrl: sourceItem ? xPostUrl(sourceItem.post) : ""
        };
      })
    }))
  };
}

function diversifyBrief(brief: GeneratedDailyBrief) {
  const totalByHandle = new Map<string, number>();

  return {
    ...brief,
    sections: brief.sections.map((section) => {
      const sectionByHandle = new Map<string, number>();

      return {
        ...section,
        items: section.items.filter((item) => {
          const handle = item.viaHandle.toLowerCase();
          if (!handle) {
            return true;
          }

          const sectionCount = sectionByHandle.get(handle) ?? 0;
          const totalCount = totalByHandle.get(handle) ?? 0;
          const isPrioritySection =
            ["priority handles", "priority sources"].includes(
              section.title.toLowerCase()
            );
          const sectionLimit = isPrioritySection ? 2 : 3;

          if (sectionCount >= sectionLimit || totalCount >= 3) {
            return false;
          }

          sectionByHandle.set(handle, sectionCount + 1);
          totalByHandle.set(handle, totalCount + 1);
          return true;
        })
      };
    })
  };
}

function dedupeBriefItems(brief: GeneratedDailyBrief) {
  const seen = createDocumentMemory([]);

  return {
    ...brief,
    sections: brief.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const article = {
          url: item.url,
          finalUrl: item.url,
          title: item.title,
          description: item.sourceLabel,
          text: `${item.title} ${item.why} ${item.takeaway}`,
          fetched: true
        };

        if (seen.hasArticle(article)) {
          return false;
        }

        seen.addArticle(article);
        return true;
      })
    }))
  };
}

function enrichBrief(options: {
  generatedBrief: GeneratedDailyBrief;
  items: DigestItem[];
  context: BriefingContext;
  watchAssessments: WatchAssessment[];
}): { brief: DailyBrief; watchRun: WatchRun } {
  const activeWatchIds = new Set(
    options.context.activeWatches.map((watch) => watch.id)
  );
  const claimedWatchIds = new Set<string>();
  const assessments = new Map(
    options.watchAssessments.map((assessment) => [
      assessment.watchId,
      assessment
    ])
  );
  const watchItems: DailyBrief["sections"][number]["items"] = [];
  const ordinarySections: DailyBrief["sections"] = [];

  for (const section of options.generatedBrief.sections) {
    const ordinaryItems: DailyBrief["sections"][number]["items"] = [];

    for (const item of section.items) {
      const sourceItem = findSourceItem(item.url, options.items);
      const watchIds = (sourceItem?.post.watchIds ?? []).filter(
        (watchId) =>
          activeWatchIds.has(watchId) &&
          !claimedWatchIds.has(watchId) &&
          assessments.get(watchId)?.status === "material" &&
          normalizeUrl(assessments.get(watchId)?.sourceUrl ?? "") ===
            normalizeUrl(item.url)
      );
      const enrichedItem = { ...item, watchIds };

      if (watchIds.length) {
        watchIds.forEach((watchId) => claimedWatchIds.add(watchId));
        watchItems.push(enrichedItem);
      } else {
        ordinaryItems.push(enrichedItem);
      }
    }

    if (
      ordinaryItems.length ||
      (section.items.length === 0 &&
        section.title !== "Watch Updates" &&
        section.title !== "Tracker Updates" &&
        section.title !== "Focus Tracker Updates")
    ) {
      ordinarySections.push({ ...section, items: ordinaryItems });
    }
  }

  for (const watch of options.context.activeWatches) {
    const assessment = assessments.get(watch.id);
    if (
      !assessment ||
      assessment.status !== "material" ||
      claimedWatchIds.has(watch.id)
    ) {
      continue;
    }

    const sourceItem = findSourceItem(assessment.sourceUrl, options.items);
    if (!sourceItem) {
      continue;
    }

    const existing = watchItems.find(
      (item) => normalizeUrl(item.url) === normalizeUrl(assessment.sourceUrl)
    );
    if (existing) {
      existing.watchIds.push(watch.id);
    } else {
      watchItems.push(watchItemFromAssessment(assessment, sourceItem, watch.id));
    }
    claimedWatchIds.add(watch.id);
  }

  let remainingItemCapacity = Math.max(
    0,
    BRIEF_ITEM_LIMIT - watchItems.length
  );
  const cappedOrdinarySections = ordinarySections
    .map((section) => {
      const items = section.items.slice(0, remainingItemCapacity);
      remainingItemCapacity -= items.length;
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0 || section.id === "quiet-feed");
  const sections: DailyBrief["sections"] = watchItems.length
    ? [
        {
          id: "watch-updates",
          title: "Focus Tracker Updates",
          summary: "Material changes found by your focus trackers.",
          items: watchItems
        },
        ...cappedOrdinarySections
      ]
    : cappedOrdinarySections;
  const followups = options.generatedBrief.followups.map((followup) => ({
    ...followup,
    id: crypto.randomUUID(),
    targetWatchId: options.context.activeWatches.some(
      (watch) =>
        watch.id === followup.targetWatchId &&
        watchCoversFollowup(watch, followup)
    )
      ? followup.targetWatchId
      : null,
    actionable: true
  }));
  const brief: DailyBrief = {
    ...options.generatedBrief,
    sections,
    followups
  };
  const checks: WatchRunCheck[] = options.context.activeWatches.map((watch) => {
    const assessment = assessments.get(watch.id);
    if (!assessment || assessment.errorMessage) {
      return {
        watchId: watch.id,
        watchTitle: watch.title,
        watchObjective: watch.objective,
        status: "error",
        matchedPostCount: assessment?.matchedPostCount ?? 0,
        sourceUrl: "",
        headline: "",
        evidenceSummary: "",
        errorMessage: assessment?.errorMessage ?? "Watch evaluation was unavailable."
      };
    }

    if (assessment.status === "material" && claimedWatchIds.has(watch.id)) {
      return {
        watchId: watch.id,
        watchTitle: watch.title,
        watchObjective: watch.objective,
        status: "material",
        matchedPostCount: assessment.matchedPostCount,
        sourceUrl: assessment.sourceUrl,
        headline: assessment.headline,
        evidenceSummary: assessment.evidenceSummary,
        errorMessage: ""
      };
    }

    return {
      watchId: watch.id,
      watchTitle: watch.title,
      watchObjective: watch.objective,
      status: "quiet",
      matchedPostCount: assessment.matchedPostCount,
      sourceUrl: "",
      headline: "",
      evidenceSummary: "",
      errorMessage: ""
    };
  });

  return { brief, watchRun: { checks } };
}

function watchItemFromAssessment(
  assessment: WatchAssessment,
  source: DigestItem,
  watchId: string
): DailyBrief["sections"][number]["items"][number] {
  const isXNative = source.kind === "x";
  return {
    title: assessment.headline || source.article.title,
    sourceLabel: isXNative
      ? formatAuthor(source.post)
      : hostLabel(source.article.finalUrl),
    url: source.article.finalUrl,
    viaHandle: source.post.authorUsername
      ? `@${source.post.authorUsername}`
      : source.post.authorName ?? "",
    viaUrl: xPostUrl(source.post),
    sourceType: isXNative ? "x-native" : "external",
    why: assessment.evidenceSummary,
    takeaway: assessment.takeaway,
    tags: assessment.tags,
    watchIds: [watchId]
  };
}

function selectFallbackCandidates(items: DigestItem[], limit: number) {
  const watchItems = items.filter((item) => item.post.watchIds.length > 0);
  const ordinaryItems = items.filter((item) => item.post.watchIds.length === 0);
  return [...watchItems, ...ordinaryItems].slice(0, limit);
}

function countBriefItems(brief: GeneratedDailyBrief | DailyBrief) {
  return brief.sections.reduce(
    (total, section) => total + section.items.length,
    0
  );
}

function findSourceItem(url: string, items: DigestItem[]) {
  return items.find(
    (item) =>
      normalizeUrl(item.article.finalUrl) === normalizeUrl(url) ||
      normalizeUrl(item.article.url) === normalizeUrl(url)
  );
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.hash = "";

    if (parsed.hostname === "twitter.com") {
      parsed.hostname = "x.com";
    }

    if (parsed.hostname === "x.com") {
      const statusId = parsed.pathname.match(/\/status\/(\d+)/)?.[1];
      if (statusId) {
        parsed.pathname = `/i/web/status/${statusId}`;
        parsed.search = "";
        return parsed.toString().replace(/\/$/, "");
      }
    }

    for (const key of [...parsed.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        [
          "fbclid",
          "gclid",
          "igshid",
          "mc_cid",
          "mc_eid",
          "ref",
          "ref_src",
          "source",
          "src",
          "si",
          "feature"
        ].includes(key)
      ) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function createDocumentMemory(storedDocuments: StoredDocumentRef[]) {
  const urls = new Set<string>();
  const titleSignatures = new Set<string>();
  const contentFingerprints = new Set<string>();
  const titleTokenSets: string[][] = [];

  for (const item of storedDocuments) {
    addArticle({
      url: item.url,
      finalUrl: item.final_url || item.url,
      title: item.content_title || item.title,
      description: item.content_description,
      text: "",
      fetched: true
    });
  }

  return {
    hasUrl(url: string) {
      return urls.has(normalizeUrl(url));
    },
    hasArticle(article: ArticleSnapshot) {
      if (
        urls.has(normalizeUrl(article.url)) ||
        urls.has(normalizeUrl(article.finalUrl))
      ) {
        return true;
      }

      const signature = titleSignature(article.title);
      if (signature && titleSignatures.has(signature)) {
        return true;
      }

      const fingerprint = contentFingerprint(article);
      if (fingerprint && contentFingerprints.has(fingerprint)) {
        return true;
      }

      const tokens = significantTokens(article.title);
      return isNearExistingTitle(tokens, titleTokenSets);
    },
    addArticle
  };

  function addArticle(article: ArticleSnapshot) {
    urls.add(normalizeUrl(article.url));
    urls.add(normalizeUrl(article.finalUrl));

    const signature = titleSignature(article.title);
    if (signature) {
      titleSignatures.add(signature);
    }

    const fingerprint = contentFingerprint(article);
    if (fingerprint) {
      contentFingerprints.add(fingerprint);
    }

    const tokens = significantTokens(article.title);
    if (tokens.length >= 5) {
      titleTokenSets.push(tokens);
    }
  }
}

function titleSignature(title: string) {
  const tokens = significantTokens(stripTitleSourceSuffix(title));
  if (tokens.length < 4) {
    return "";
  }

  return tokens.join(" ");
}

function contentFingerprint(article: ArticleSnapshot) {
  const value = normalizeText(
    [article.title, article.description, article.text.slice(0, 1400)].join(" ")
  );

  if (value.length < 160) {
    return "";
  }

  return value.slice(0, 260);
}

function isNearExistingTitle(tokens: string[], existing: string[][]) {
  if (tokens.length < 5) {
    return false;
  }

  return existing.some((other) => jaccard(tokens, other) >= 0.78);
}

function jaccard(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (leftSet.size + rightSet.size - intersection);
}

function significantTokens(value: string) {
  return normalizeText(stripTitleSourceSuffix(value))
    .split(" ")
    .filter(
      (token) =>
        token.length > 2 &&
        ![
          "about",
          "after",
          "again",
          "against",
          "with",
          "without",
          "from",
          "into",
          "over",
          "under",
          "this",
          "that",
          "these",
          "those",
          "have",
          "has",
          "had",
          "will",
          "would",
          "could",
          "should",
          "their",
          "there",
          "what",
          "when",
          "where",
          "your",
          "here",
          "they",
          "them",
          "than",
          "then",
          "only",
          "also"
        ].includes(token)
    );
}

function stripTitleSourceSuffix(value: string) {
  return value.replace(/\s+[-|–—]\s+.{1,40}$/u, "");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\w-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingRejectedColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.includes("rejected_at") ||
    error.message?.includes("schema cache")
  );
}

function isMissingDigestSnapshotColumns(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("final_url") ||
    error.message?.includes("content_text") ||
    error.message?.includes("schema cache")
  );
}

function isSubstantialXPost(post: XPost) {
  const text = post.longText ?? post.text;
  return text.length >= 240;
}

function xPostUrl(post: XPost) {
  if (post.authorUsername) {
    return `https://x.com/${post.authorUsername}/status/${post.id}`;
  }

  return `https://x.com/i/web/status/${post.id}`;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isPriorityAuthor(post: XPost, handles: string[]) {
  if (!post.authorUsername) {
    return false;
  }

  return handles.includes(post.authorUsername.toLowerCase());
}

function formatAuthor(post: XPost) {
  if (post.authorUsername) {
    return `${post.authorName ?? post.authorUsername} (@${post.authorUsername})`;
  }

  return "unknown";
}

function isLowValueUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return [
      "x.com",
      "twitter.com",
      "t.co",
      "youtube.com",
      "youtu.be",
      "linkedin.com",
      "instagram.com"
    ].some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return true;
  }
}
