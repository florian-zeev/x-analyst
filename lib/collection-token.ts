import { createHmac, timingSafeEqual } from "crypto";

type CollectionSaveTokenPayload = {
  userId: string;
  digestId: string;
  url: string;
  exp: number;
};

export function createCollectionSaveToken(
  payload: Omit<CollectionSaveTokenPayload, "exp">,
  expiresInSeconds = 60 * 60 * 24 * 30
) {
  const fullPayload: CollectionSaveTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = signTokenBody(body);
  return `${body}.${signature}`;
}

export function verifyCollectionSaveToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = signTokenBody(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as CollectionSaveTokenPayload;

    if (
      !payload.userId ||
      !payload.digestId ||
      !payload.url ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function canCreateCollectionSaveLinks() {
  return Boolean(getTokenSecret() && process.env.APP_BASE_URL);
}

function signTokenBody(body: string) {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error(
      "Collection save links need COLLECTION_TOKEN_SECRET or CRON_SECRET."
    );
  }

  return createHmac("sha256", secret).update(body).digest("base64url");
}

function getTokenSecret() {
  return process.env.COLLECTION_TOKEN_SECRET ?? process.env.CRON_SECRET ?? "";
}
