import { generateObject } from "ai";
import { Client } from "eve/client";
import {
  type DailyBrief,
  dailyBriefSchema,
  encodeStructuredBrief,
  structuredBriefToHtml,
  structuredBriefToMarkdown
} from "@/lib/brief";
import { fetchArticle, type ArticleSnapshot } from "@/lib/article";
import { sendDigestEmail } from "@/lib/email";
import { getLearningContext } from "@/lib/learning";
import { type AnalystProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchXPosts, type XPost } from "@/lib/x";
import {
  canCreateCollectionSaveLinks,
  createCollectionSaveToken
} from "@/lib/collection-token";

export type DigestItem = {
  post: XPost;
  article: ArticleSnapshot;
  kind: "x" | "link";
};

export type RunDigestOptions = {
  localDate?: string | null;
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
  const posts = await fetchXPosts({
    listId: profile.xListId,
    discoveryQueries: profile.discoveryQueries
  });

  const storedDocuments = await getStoredDocumentRefs(profile.userId);
  const rejectedUrls = await getRejectedUrls(profile.userId);
  const items = filterRejectedItems(
    await collectArticles(posts, storedDocuments),
    rejectedUrls
  );
  const brief = await writeBriefWithEveFallback(profile, items);
  const briefItemCount = countBriefItems(brief);
  const body = encodeStructuredBrief(brief);
  const subject = `X Analyst Brief - ${new Date().toISOString().slice(0, 10)}`;

  const admin = createAdminClient();
  const { data: digest, error } = await admin
    .from("digests")
    .insert({
      user_id: profile.userId,
      subject,
      body_md: body,
      item_count: briefItemCount,
      digest_local_date: options.localDate ?? null
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await storeDigestItemsForBrief({
    digestId: digest.id,
    userId: profile.userId,
    subject,
    createdAt: digest.created_at,
    brief,
    sourceItems: items
  });

  const deliveryEmail = profile.digestEmail ?? profile.email;
  let sentAt: string | null = null;
  let emailError: string | null = null;
  if (deliveryEmail) {
    try {
      const result = await sendDigestEmail({
        to: deliveryEmail,
        subject,
        markdown: structuredBriefToMarkdown(brief),
        html: structuredBriefToHtml(brief, {
          saveUrlForItem: canCreateCollectionSaveLinks()
            ? (item) => collectionSaveUrl(profile.userId, digest.id, item.url)
            : undefined
        })
      });

      if (result.sent) {
        sentAt = new Date().toISOString();
        await admin
          .from("digests")
          .update({ sent_at: sentAt })
          .eq("id", digest.id);
      }
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Email failed.";
    }
  }

  return {
    id: digest.id,
    subject,
    body,
    itemCount: briefItemCount,
    sentAt,
    emailError
  };
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
    return;
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
        return;
      }
    }

    throw error;
  }
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

async function writeBrief(profile: AnalystProfile, items: DigestItem[]) {
  const learning = await getLearningContext(profile.userId);

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
    };
  }

  const sourcePack = formatSourcePack(profile, items);

  const { object } = await generateObject({
    model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini",
    schema: dailyBriefSchema,
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
      "If an item comes from a priority handle, treat that as a signal to inspect it more carefully and consider elevating it when the substance matches the reader profile. Do not include it solely because of the handle.",
      "Diversity is part of quality. Avoid multiple items that say the same thing from the same handle, organization, publication, project, person, or topic cluster.",
      "If a priority handle posts a thread or several related updates about the same announcement, choose the single most canonical or information-rich post and summarize the cluster once.",
      "Do not include more than two items from the same priority handle in the priority-source section unless they are clearly unrelated stories.",
      "Prefer a varied brief across authors, sources, organizations, developments, debates, research, evidence, and signals over exhaustive coverage of one source.",
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
      "",
      "Use Priority Sources for substantive items from configured priority X handles. That section must only contain items whose Priority author field is yes.",
      "Each item must have title, sourceLabel, url, viaHandle, viaUrl, sourceType, why, takeaway, and tags.",
      "Set viaHandle and viaUrl to empty strings; the application will attach exact X provenance after generation.",
      "Do not assign numeric ratings. They create false precision. Rank through section placement and concise prose instead.",
      "When citing X-native items, url must link to the X post and why must describe why the post itself is worth reading."
    ].join("\n")
  });

  return dedupeBriefItems(diversifyBrief(attachTweetProvenance(object, items)));
}

async function writeBriefWithEve(profile: AnalystProfile, items: DigestItem[]) {
  const learning = await getLearningContext(profile.userId);

  if (items.length === 0) {
    return writeBrief(profile, items);
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
  const response = await session.send<DailyBrief>({
    outputSchema: dailyBriefSchema,
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
          learning
        },
        null,
        2
      ),
      "",
      "Candidate items from X, including X-native long posts/articles and linked articles:",
      formatSourcePack(profile, items),
      "",
      "Editorial requirements:",
      "- Title must be exactly Daily Brief.",
      "- Prefer fewer, higher-signal items.",
      "- Avoid duplicates and near-duplicates.",
      "- Use Priority Sources only for substantive items from configured priority handles.",
      "- Do not assign numeric ratings.",
      "- For X-native items, url must point to the X post itself.",
      "- Set viaHandle and viaUrl to empty strings; the app attaches exact X provenance after generation."
    ].join("\n")
  });

  const result = await response.result();

  if (result.status !== "completed" || !result.data) {
    throw new Error(
      `Eve brief workflow failed with status ${result.status}: ${
        result.message || "No structured result."
      }`
    );
  }

  return dedupeBriefItems(
    diversifyBrief(attachTweetProvenance(dailyBriefSchema.parse(result.data), items))
  );
}

async function writeBriefWithEveFallback(
  profile: AnalystProfile,
  items: DigestItem[]
) {
  try {
    return await writeBriefWithEve(profile, items);
  } catch (error) {
    console.error("Eve brief workflow failed; falling back to direct writer.", {
      error
    });
    return writeBrief(profile, items);
  }
}

function formatSourcePack(profile: AnalystProfile, items: DigestItem[]) {
  return items
    .map((item, index) =>
      [
        `ITEM ${index + 1}`,
        `Kind: ${item.kind === "x" ? "X-native post/article" : "External link"}`,
        `X text: ${item.post.longText ?? item.post.text}`,
        `Author: ${formatAuthor(item.post)}`,
        `Priority author: ${isPriorityAuthor(item.post, profile.priorityHandles) ? "yes" : "no"}`,
        `Source: ${item.post.source}`,
        `URL: ${item.article.finalUrl}`,
        `Host: ${hostLabel(item.article.finalUrl)}`,
        `Title: ${item.article.title}`,
        `Description: ${item.article.description}`,
        `Article excerpt: ${item.article.text.slice(0, 1800)}`
      ].join("\n")
    )
    .join("\n\n---\n\n");
}

function resolveEveHost() {
  return (
    process.env.EVE_AGENT_HOST ??
    process.env.APP_BASE_URL ??
    "http://localhost:3000"
  );
}

function attachTweetProvenance(
  brief: DailyBrief,
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

function diversifyBrief(brief: DailyBrief) {
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

function dedupeBriefItems(brief: DailyBrief) {
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

function countBriefItems(brief: DailyBrief) {
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
