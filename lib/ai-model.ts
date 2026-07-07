import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";

const defaultOpenAIModel = "gpt-5.4-mini";
const defaultGroqSubagentModel = "openai/gpt-oss-120b";

export function briefingModel() {
  return openai(openAIModelId());
}

export function subagentModel() {
  return groq(groqSubagentModelId());
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

export function groqSubagentModelId() {
  return process.env.GROQ_SUBAGENT_MODEL?.trim() || defaultGroqSubagentModel;
}
