export type XPost = {
  id: string;
  text: string;
  longText?: string;
  authorUsername?: string;
  authorName?: string;
  createdAt?: string;
  urls: string[];
  source: string;
};

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

export async function fetchXPosts(options: {
  listId?: string | null;
  discoveryQueries: string[];
  maxPerSource?: number;
}) {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    throw new Error("Missing X_BEARER_TOKEN.");
  }

  const maxPerSource = options.maxPerSource ?? 25;
  const posts: XPost[] = [];

  if (options.listId) {
    posts.push(
      ...(await fetchTimeline(
        `https://api.x.com/2/lists/${options.listId}/tweets`,
        token,
        { max_results: String(Math.min(Math.max(maxPerSource, 5), 100)) },
        "list"
      ))
    );
  }

  for (const query of options.discoveryQueries.slice(0, 5)) {
    const normalizedQuery = `${query} -is:retweet lang:en`;
    posts.push(
      ...(await fetchTimeline(
        "https://api.x.com/2/tweets/search/recent",
        token,
        {
          query: normalizedQuery,
          max_results: String(Math.min(Math.max(maxPerSource, 10), 100))
        },
        `search:${query}`
      ))
    );
  }

  const byId = new Map<string, XPost>();
  for (const post of posts) {
    byId.set(post.id, post);
  }

  return [...byId.values()];
}

async function fetchTimeline(
  baseUrl: string,
  token: string,
  params: Record<string, string>,
  source: string
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
    throw new Error(`X API request failed: ${response.status}`);
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
      .filter((url): url is string => Boolean(url));

    return {
      id: tweet.id,
      text: tweet.text,
      longText: tweet.note_tweet?.text,
      authorUsername: author?.username,
      authorName: author?.name,
      createdAt: tweet.created_at,
      urls,
      source
    };
  });
}
