import { fetchArticle } from "@/lib/article";
import { createAdminClient } from "@/lib/supabase/admin";

type SaveCollectionItemOptions = {
  userId: string;
  digestId: string;
  itemUrl: string;
  note: string;
};

export async function saveCollectionItemFromDigest({
  userId,
  digestId,
  itemUrl,
  note
}: SaveCollectionItemOptions) {
  const admin = createAdminClient();
  const { data: item, error } = await admin
    .from("digest_items")
    .select("*")
    .eq("user_id", userId)
    .eq("digest_id", digestId)
    .eq("url", itemUrl)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!item) {
    throw new Error("Could not find this digest item.");
  }

  const shouldPreferDigestSnapshot =
    item.source_type === "x-native" || isXUrl(item.url);
  const article = shouldPreferDigestSnapshot
    ? null
    : await fetchArticle(item.final_url || item.url);
  const contentText = cleanSnapshotText(
    shouldPreferDigestSnapshot
      ? item.content_text || [item.why, item.takeaway].filter(Boolean).join("\n\n")
      : article?.text ||
          item.content_text ||
          [item.why, item.takeaway].filter(Boolean).join("\n\n"),
    item.via_handle
  );
  const now = new Date().toISOString();

  const { error: saveError } = await admin.from("collection_items").upsert(
    {
      user_id: userId,
      digest_id: item.digest_id,
      digest_item_id: item.id,
      digest_subject: item.digest_subject,
      digest_created_at: item.digest_created_at,
      section_title: item.section_title,
      title: item.title,
      source_label: item.source_label,
      url: item.url,
      final_url: article?.finalUrl || item.final_url || item.url,
      via_handle: item.via_handle,
      via_url: item.via_url,
      source_type: item.source_type,
      why: item.why,
      takeaway: item.takeaway,
      tags: item.tags,
      note,
      content_title: article?.title || item.content_title || item.title,
      content_description:
        article?.description || item.content_description || item.takeaway,
      content_text: contentText,
      metadata: {
        fetched: article?.fetched ?? Boolean(item.content_text),
        savedFrom: "digest"
      },
      updated_at: now
    },
    {
      onConflict: "user_id,url"
    }
  );

  if (saveError) {
    throw saveError;
  }
}

function isXUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname === "x.com" || hostname === "twitter.com";
  } catch {
    return false;
  }
}

function cleanSnapshotText(text: string, viaHandle = "") {
  let cleaned = text
    .replace(/:host(?:\(|\{)[\s\S]*$/g, "")
    .replace(/\bNew to X\?[\s\S]*$/g, "")
    .replace(/\s*\/ X Post Log in Sign up Post\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (viaHandle) {
    const handlePattern = escapeRegExp(viaHandle);
    cleaned = cleaned.replace(
      new RegExp(`^[\\s\\S]*?${handlePattern}\\s+`, "i"),
      ""
    );
  }

  return cleaned.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
