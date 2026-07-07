import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Read linked articles and X-native long posts, extracting clean claims, evidence, provenance, and caveats.",
  model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini"
});
