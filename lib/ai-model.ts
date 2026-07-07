import { openai } from "@ai-sdk/openai";

const defaultOpenAIModel = "gpt-5.4-mini";

export function briefingModel() {
  return openai(openAIModelId());
}

export function openAIModelId() {
  const configured = process.env.AI_MODEL?.trim();
  if (!configured) {
    return defaultOpenAIModel;
  }

  return configured.startsWith("openai/")
    ? configured.slice("openai/".length)
    : configured;
}
