import { defineSchedule } from "eve/schedules";
import { deliveryCronExpression } from "@/lib/delivery-schedule";

export default defineSchedule({
  cron: deliveryCronExpression(),
  run({ waitUntil }) {
    waitUntil(runDailyDigest());
  }
});

async function runDailyDigest() {
  const baseUrl = process.env.APP_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl || !cronSecret) {
    throw new Error("Missing APP_BASE_URL or CRON_SECRET.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/digest/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason: "eve scheduled delivery sweep" })
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Scheduled digest failed: ${response.status} ${body}`);
  }

  console.log(`Scheduled digest completed: ${body}`);
}
