export type ArticleSnapshot = {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  text: string;
  fetched: boolean;
};

export async function fetchArticle(url: string): Promise<ArticleSnapshot> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "X Analyst/0.1 (+https://github.com/florian-zeev/x-analyst)"
      },
      next: {
        revalidate: 0
      }
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return emptySnapshot(url, response.url || url);
    }

    const html = await response.text();
    const title =
      readMeta(html, "og:title") ?? readTitle(html) ?? response.url ?? url;
    const description =
      readMeta(html, "og:description") ??
      readMeta(html, "description") ??
      "";

    return {
      url,
      finalUrl: response.url || url,
      title: cleanText(title).slice(0, 240),
      description: cleanText(description).slice(0, 500),
      text: extractReadableText(html).slice(0, 5000),
      fetched: true
    };
  } catch {
    return emptySnapshot(url, url);
  }
}

function emptySnapshot(url: string, finalUrl: string): ArticleSnapshot {
  return {
    url,
    finalUrl,
    title: finalUrl,
    description: "",
    text: "",
    fetched: false
  };
}

function readTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1];
}

function readMeta(html: string, name: string) {
  const propertyPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegExp(name)}["'][^>]*>`,
    "i"
  );

  return html.match(propertyPattern)?.[1] ?? html.match(contentFirstPattern)?.[1];
}

function extractReadableText(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function cleanText(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
