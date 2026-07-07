import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Scan X and open-web candidate material broadly, identify high-signal items, and suppress obvious repeats before deeper analysis.",
  model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini"
});
