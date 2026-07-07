import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Run the X Analyst daily brief endpoint.",
  inputSchema: z.object({
    reason: z.string().default("scheduled daily brief")
  }),
  async execute(input) {
    const baseUrl = process.env.APP_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;

    if (!baseUrl || !cronSecret) {
      throw new Error("Missing APP_BASE_URL or CRON_SECRET.");
    }

    const response = await fetch(`${baseUrl}/api/digest/run`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ reason: input.reason })
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Brief run failed: ${response.status} ${body}`);
    }

    return body;
  }
});
