import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.AI_MODEL ?? "openai/gpt-5.4-mini"
});
