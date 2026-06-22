import { generateText } from "ai";
import { fetchArticle, type ArticleSnapshot } from "@/lib/article";
import { sendDigestEmail } from "@/lib/email";
import { type AnalystProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchXPosts, type XPost } from "@/lib/x";

export type DigestItem = {
  post: XPost;
  article: ArticleSnapshot;
};

export async function runDigestForProfile(profile: AnalystProfile) {
  const posts = await fetchXPosts({
    listId: profile.xListId,
    discoveryQueries: profile.discoveryQueries
  });

  const items = await collectArticles(posts);
  const body = await writeBrief(profile, items);
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

  let sentAt: string | null = null;
  if (profile.digestEmail) {
    const result = await sendDigestEmail({
      to: profile.digestEmail,
      subject,
      markdown: body
    });

    if (result.sent) {
      sentAt = new Date().toISOString();
      await admin
        .from("digests")
        .update({ sent_at: sentAt })
        .eq("id", digest.id);
    }
  }

  return {
    id: digest.id,
    subject,
    body,
    itemCount: items.length,
    sentAt
  };
}

async function collectArticles(posts: XPost[]) {
  const seen = new Set<string>();
  const candidates: DigestItem[] = [];

  for (const post of posts.slice(0, 80)) {
    for (const url of post.urls.slice(0, 2)) {
      if (seen.has(url) || isLowValueUrl(url)) {
        continue;
      }
      seen.add(url);
      const article = await fetchArticle(url);
      candidates.push({ post, article });
    }
  }

  return candidates.slice(0, 50);
}

async function writeBrief(profile: AnalystProfile, items: DigestItem[]) {
  if (items.length === 0) {
    return [
      "# Presidential Daily Brief",
      "",
      "No linked articles or product announcements were found in the configured sources today.",
      "",
      "Check the X list ID, discovery queries, and X API access if this looks unexpectedly quiet."
    ].join("\n");
  }

  const sourcePack = items
    .map((item, index) =>
      [
        `ITEM ${index + 1}`,
        `Tweet: ${item.post.text}`,
        `Author: ${formatAuthor(item.post)}`,
        `Source: ${item.post.source}`,
        `URL: ${item.article.finalUrl}`,
        `Title: ${item.article.title}`,
        `Description: ${item.article.description}`,
        `Article excerpt: ${item.article.text.slice(0, 1800)}`
      ].join("\n")
    )
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini",
    system: [
      "You are a senior AI industry analyst writing a presidential daily brief.",
      "Rank ruthlessly against the reader's stated interests.",
      "Prefer primary sources, new technical depth, concrete launches, and market-moving company/product signals.",
      "Do not include filler. Include source links for every item you mention."
    ].join(" "),
    prompt: [
      "Reader interest profile:",
      profile.interestProfileMd,
      "",
      "Candidate items from X and linked articles:",
      sourcePack,
      "",
      "Write a concise Markdown brief with these sections:",
      "# Presidential Daily Brief",
      "## BLUF",
      "## Must Read",
      "## Product And Framework Watch",
      "## Market Signals",
      "## Interesting But Lower Priority",
      "## Suggested Follows Or Sources",
      "",
      "For each item, include why it matters, a relevance score from 1-10, and the link."
    ].join("\n")
  });

  return text;
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
