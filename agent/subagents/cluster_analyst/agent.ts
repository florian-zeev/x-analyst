import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Group related candidates, identify duplicates and near-duplicates, and choose the most canonical source for each story.",
  model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini"
});
