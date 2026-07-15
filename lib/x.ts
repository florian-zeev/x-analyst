import { createHash } from "node:crypto";
import { logBriefError } from "./brief-logs.ts";
import {
  parseXApiErrorBody,
  publicXErrorMessage,
  type XApiErrorDetails
} from "./x-api-error.ts";

export type XPost = {
  id: string;
  text: string;
  longText?: string;
  authorUsername?: string;
  authorName?: string;
  createdAt?: string;
  urls: string[];
  source: string;
  sourceIds: string[];
  watchIds: string[];
};

export type XWatchQuery = {
  id: string;
  queries: string[];
};

export type XWatchError = {
  watchId: string;
  message: string;
};

export type XWatchQuerySample = {
  query: string;
  posts: XPost[];
  error: string | null;
};

export type FetchXPostsResult = {
  posts: XPost[];
  successfulWatchIds: string[];
  watchErrors: XWatchError[];
  sourceCounts: {
    list: number;
    discovery: number;
    watches: number;
  };
};

export async function validateXWatchQueries(queries: string[]) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("Missing X_BEARER_TOKEN.");
  }

  const results = await sampleXWatchQueries(queries, token);
  const accepted = results.filter((result) => !result.error);
  if (!accepted.length) {
    throw new Error(results[0]?.error ?? "X rejected the generated searches.");
  }

  return {
    queries: accepted.map((result) => result.query),
    matchedPostCount: accepted.reduce(
      (total, result) => total + result.posts.length,
      0
    ),
    samples: accepted.map(({ query, posts }) => ({ query, posts }))
  };
}

async function sampleXWatchQueries(
  queries: string[],
  token: string
): Promise<XWatchQuerySample[]> {
  return Promise.all(
    queries.slice(0, 3).map(async (query, index) => {
      try {
        const posts = await fetchTimeline(
          "https://api.x.com/2/tweets/search/recent",
          token,
          { query: withDefaultSearchConstraints(query), max_results: "10" },
          {
            id: `watch:validation:${index}`,
            label: "watch-validation"
          }
        );
        return { query, posts, error: null };
      } catch (error) {
        return {
          query,
          posts: [] as XPost[],
          error: sanitizeWatchError(error)
        };
      }
    })
  );
}

type XTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  note_tweet?: {
    text?: string;
    entities?: {
      urls?: Array<{
        expanded_url?: string;
        unwound_url?: string;
        display_url?: string;
        url?: string;
      }>;
    };
  };
  entities?: {
    urls?: Array<{
      expanded_url?: string;
      unwound_url?: string;
      display_url?: string;
      url?: string;
    }>;
  };
};

type XUser = {
  id: string;
  name?: string;
  username?: string;
};

type SourceDescriptor = {
  id: string;
  label: string;
  watchId?: string;
};

export async function fetchXPosts(options: {
  listId?: string | null;
  discoveryQueries: string[];
  watches?: XWatchQuery[];
  maxPerSource?: number;
}): Promise<FetchXPostsResult> {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    throw new Error("Missing X_BEARER_TOKEN.");
  }

  const maxPerSource = options.maxPerSource ?? 25;
  const profileRequests: Array<Promise<XPost[]>> = [];

  if (options.listId) {
    profileRequests.push(
      fetchTimeline(
        `https://api.x.com/2/lists/${options.listId}/tweets`,
        token,
        { max_results: String(Math.min(Math.max(maxPerSource, 5), 100)) },
        { id: "list", label: "list" }
      )
    );
  }

  for (const [index, query] of options.discoveryQueries.slice(0, 5).entries()) {
    profileRequests.push(
      fetchTimeline(
        "https://api.x.com/2/tweets/search/recent",
        token,
        {
          query: withDefaultSearchConstraints(query),
          max_results: String(Math.min(Math.max(maxPerSource, 10), 100))
        },
        { id: `discovery:${index}`, label: `search:${query}` }
      )
    );
  }

  const profileGroups = await Promise.all(profileRequests);
  const watchResults = await mapWithConcurrency(
    (options.watches ?? []).slice(0, 5),
    3,
    async (watch) => {
      const variants = await Promise.all(
        watch.queries.slice(0, 3).map(async (query, index) => {
          try {
            const posts = await fetchTimeline(
              "https://api.x.com/2/tweets/search/recent",
              token,
              {
                query: withDefaultSearchConstraints(query),
                max_results: "10"
              },
              {
                id: `watch:${watch.id}:${index}`,
                label: "watch",
                watchId: watch.id
              }
            );
            return { posts, error: null };
          } catch (error) {
            return { posts: [] as XPost[], error: sanitizeWatchError(error) };
          }
        })
      );
      const successful = variants.filter((variant) => !variant.error);
      return {
        watchId: watch.id,
        posts: successful.flatMap((variant) => variant.posts),
        error:
          successful.length > 0
            ? null
            : variants[0]?.error ?? "X watch query failed."
      };
    }
  );

  const merged = mergePosts([
    ...profileGroups.flat(),
    ...watchResults.flatMap((result) => result.posts)
  ]);
  const posts = interleavePosts(merged, (options.watches ?? []).map((watch) => watch.id));

  return {
    posts,
    successfulWatchIds: watchResults
      .filter((result) => !result.error)
      .map((result) => result.watchId),
    watchErrors: watchResults
      .filter((result) => result.error)
      .map((result) => ({
        watchId: result.watchId,
        message: result.error ?? "X watch query failed."
      })),
    sourceCounts: {
      list: posts.filter((post) => post.sourceIds.includes("list")).length,
      discovery: posts.filter((post) =>
        post.sourceIds.some((source) => source.startsWith("discovery:"))
      ).length,
      watches: posts.filter((post) => post.watchIds.length > 0).length
    }
  };
}

function withDefaultSearchConstraints(query: string) {
  return `${query} -is:retweet lang:en`;
}

async function fetchTimeline(
  baseUrl: string,
  token: string,
  params: Record<string, string>,
  source: SourceDescriptor
) {
  const url = new URL(baseUrl);
  url.searchParams.set(
    "tweet.fields",
    "created_at,entities,author_id,note_tweet"
  );
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "name,username");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    const requestId = crypto.randomUUID();
    const details = parseXApiErrorBody(await response.text());
    const query = params.query;
    const error = new XApiRequestError({
      status: response.status,
      requestId,
      details
    });
    logBriefError("x_api_request_failed", error, {
      requestId,
      endpoint: url.pathname,
      sourceId: source.id,
      watchId: source.watchId ?? null,
      status: response.status,
      errorType: details.type,
      errorTitle: details.title,
      errorDetail: details.detail,
      queryHash: query ? hashQuery(query) : null,
      queryPreview: query ? previewQuery(query) : null,
      queryLength: query?.length ?? null,
      xRequestId:
        response.headers.get("x-request-id") ??
        response.headers.get("x-transaction-id"),
      rateLimit: {
        limit: response.headers.get("x-rate-limit-limit"),
        remaining: response.headers.get("x-rate-limit-remaining"),
        reset: response.headers.get("x-rate-limit-reset")
      }
    });
    throw error;
  }

  const payload = (await response.json()) as {
    data?: XTweet[];
    includes?: {
      users?: XUser[];
    };
  };

  const users = new Map(
    (payload.includes?.users ?? []).map((user) => [user.id, user])
  );

  return (payload.data ?? []).map((tweet) => {
    const author = tweet.author_id ? users.get(tweet.author_id) : undefined;
    const urls = [
      ...(tweet.entities?.urls ?? []),
      ...(tweet.note_tweet?.entities?.urls ?? [])
    ]
      .map((item) => item.unwound_url ?? item.expanded_url ?? item.url)
      .filter((value): value is string => Boolean(value));

    return {
      id: tweet.id,
      text: tweet.text,
      longText: tweet.note_tweet?.text,
      authorUsername: author?.username,
      authorName: author?.name,
      createdAt: tweet.created_at,
      urls,
      source: source.label,
      sourceIds: [source.id],
      watchIds: source.watchId ? [source.watchId] : []
    } satisfies XPost;
  });
}

export function mergePosts(posts: XPost[]) {
  const byId = new Map<string, XPost>();

  for (const post of posts) {
    const existing = byId.get(post.id);
    if (!existing) {
      byId.set(post.id, post);
      continue;
    }

    byId.set(post.id, {
      ...existing,
      sourceIds: union(existing.sourceIds, post.sourceIds),
      watchIds: union(existing.watchIds, post.watchIds),
      urls: union(existing.urls, post.urls)
    });
  }

  return [...byId.values()];
}

export function interleavePosts(posts: XPost[], watchIds: string[]) {
  const selected: XPost[] = [];
  const seen = new Set<string>();
  const take = (candidates: XPost[], count: number) => {
    for (const post of candidates) {
      if (selected.length >= 80 || count <= 0) {
        break;
      }
      if (seen.has(post.id)) {
        continue;
      }
      selected.push(post);
      seen.add(post.id);
      count -= 1;
    }
  };

  take(
    posts.filter((post) => post.sourceIds.includes("list")),
    30
  );
  take(
    posts.filter((post) =>
      post.sourceIds.some((source) => source.startsWith("discovery:"))
    ),
    25
  );
  for (const watchId of watchIds.slice(0, 5)) {
    take(
      posts.filter((post) => post.watchIds.includes(watchId)),
      5
    );
  }
  take(posts, 80 - selected.length);

  return selected;
}

function union(left: string[], right: string[]) {
  return [...new Set([...left, ...right])];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

function sanitizeWatchError(error: unknown) {
  if (error instanceof XApiRequestError) {
    return publicXErrorMessage(error.status);
  }
  return "X could not complete this search.";
}

class XApiRequestError extends Error {
  readonly status: number;
  readonly requestId: string;
  readonly details: XApiErrorDetails;

  constructor(options: {
    status: number;
    requestId: string;
    details: XApiErrorDetails;
  }) {
    super(`X API request failed with status ${options.status}.`);
    this.name = "XApiRequestError";
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

function hashQuery(query: string) {
  return createHash("sha256").update(query).digest("hex").slice(0, 12);
}

function previewQuery(query: string) {
  const normalized = query.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}
