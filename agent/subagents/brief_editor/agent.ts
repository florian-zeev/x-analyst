import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Write the final concise X Analyst dossier from selected, deduplicated evidence and the reader interest profile.",
  model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini"
});
