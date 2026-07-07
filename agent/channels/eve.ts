import { eveChannel } from "eve/channels/eve";
import { extractBearerToken } from "eve/channels/auth";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [localDev(), vercelOidc(), cronSecretAuth]
});

function cronSecretAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!cronSecret || token !== cronSecret) {
    return null;
  }

  return {
    attributes: {},
    authenticator: "bearer",
    issuer: "x-analyst",
    principalId: "x-analyst:digest-cron",
    principalType: "service",
    subject: "digest-cron"
  };
}
