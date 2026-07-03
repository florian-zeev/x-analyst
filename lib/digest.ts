import { generateObject } from "ai";
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

export type DigestItem = {
  post: XPost;
  article: ArticleSnapshot;
  kind: "x" | "link";
};

export async function runDigestForProfile(profile: AnalystProfile) {
  const posts = await fetchXPosts({
    listId: profile.xListId,
    discoveryQueries: profile.discoveryQueries
  });

  const items = await collectArticles(posts);
  const brief = await writeBrief(profile, items);
  const body = encodeStructuredBrief(brief);
  const subject = `X Analyst Brief - ${new Date().toISOString().slice(0, 10)}`;

  const admin = createAdminClient();
  const { data: digest, error } = await admin
    .from("digests")
    .insert({
      user_id: profile.userId,
      subject,
      body_md: body,
      item_count: items.length
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const deliveryEmail = profile.digestEmail ?? profile.email;
  let sentAt: string | null = null;
  let emailError: string | null = null;
  if (deliveryEmail) {
    try {
      const result = await sendDigestEmail({
        to: deliveryEmail,
        subject,
        markdown: structuredBriefToMarkdown(brief),
        html: structuredBriefToHtml(brief)
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
    itemCount: items.length,
    sentAt,
    emailError
  };
}

async function collectArticles(posts: XPost[]) {
  const seen = new Set<string>();
  const candidates: DigestItem[] = [];

  for (const post of posts.slice(0, 80)) {
    let addedLinkedItem = false;

    for (const url of post.urls.slice(0, 2)) {
      if (seen.has(url) || isLowValueUrl(url)) {
        continue;
      }
      seen.add(url);
      const article = await fetchArticle(url);
      candidates.push({ post, article, kind: "link" });
      addedLinkedItem = true;
    }

    if (!addedLinkedItem && isSubstantialXPost(post)) {
      const url = xPostUrl(post);
      if (!seen.has(url)) {
        seen.add(url);
        candidates.push({
          post,
          kind: "x",
          article: {
            url,
            finalUrl: url,
            title: `X post by ${formatAuthor(post)}`,
            description: post.longText ?? post.text,
            text: post.longText ?? post.text,
            fetched: true
          }
        });
      }
    }
  }

  return candidates.slice(0, 50);
}

async function writeBrief(profile: AnalystProfile, items: DigestItem[]) {
  const learning = await getLearningContext(profile.userId);

  if (items.length === 0) {
    return {
      title: "Daily Brief" as const,
      bluf:
        "No strong linked articles, X-native long posts, or product announcements were found in the configured sources today.",
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

  const sourcePack = items
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

  const { object } = await generateObject({
    model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini",
    schema: dailyBriefSchema,
    system: [
      "You are a senior AI industry analyst writing a daily brief.",
      "Rank ruthlessly against the reader's stated interests.",
      "Prefer primary sources, new technical depth, concrete launches, and market-moving company/product signals.",
      "Do not include filler. Include source links for every item you mention.",
      "Return compact structured data for a UI. Never put raw long URLs in prose; put the full target only in the url field.",
      "Use sourceLabel for the visible label, such as the host, article title, product name, or X handle."
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
      "Diversity is part of quality. Avoid multiple items that say the same thing from the same handle, company, product, or topic cluster.",
      "If a priority handle posts a thread or several related updates about the same announcement, choose the single most canonical or information-rich post and summarize the cluster once.",
      "Do not include more than two items from the same priority handle in the Priority Handles section unless they are clearly unrelated stories.",
      "Prefer a varied brief across authors, companies, products, research, infrastructure, security, and market signals over exhaustive coverage of one source.",
      "",
      "Create a concise structured brief with title exactly: Daily Brief.",
      "",
      "Use these section titles when relevant:",
      "Must Read",
      "Priority Handles",
      "Product And Framework Watch",
      "Market Signals",
      "X-Native Reads",
      "Interesting But Lower Priority",
      "",
      "Use Priority Handles for substantive items from configured priority X handles. That section must only contain items whose Priority author field is yes.",
      "Each item must have title, sourceLabel, url, viaHandle, viaUrl, sourceType, why, takeaway, and tags.",
      "Set viaHandle and viaUrl to empty strings; the application will attach exact X provenance after generation.",
      "Do not assign numeric ratings. They create false precision. Rank through section placement and concise prose instead.",
      "When citing X-native items, url must link to the X post and why must describe why the post itself is worth reading."
    ].join("\n")
  });

  return diversifyBrief(attachTweetProvenance(object, items));
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
            section.title.toLowerCase() === "priority handles";
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
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
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
