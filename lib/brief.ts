import { z } from "zod";

export const briefItemSchema = z.object({
  title: z.string(),
  sourceLabel: z.string(),
  url: z.string(),
  viaHandle: z.string(),
  viaUrl: z.string(),
  sourceType: z.enum(["external", "x-native", "company", "framework", "research"]),
  why: z.string(),
  takeaway: z.string(),
  tags: z.array(z.string()).max(4)
});

export const briefSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  items: z.array(briefItemSchema)
});

export const dailyBriefSchema = z.object({
  title: z.literal("Daily Brief"),
  bluf: z.string(),
  generatedFor: z.string(),
  sections: z.array(briefSectionSchema),
  followups: z.array(z.string())
});

export type DailyBrief = z.infer<typeof dailyBriefSchema>;

const structuredBriefEnvelopeSchema = z.object({
  kind: z.literal("x-analyst.daily-brief"),
  version: z.literal(1),
  brief: dailyBriefSchema
});

export type StructuredBriefEnvelope = z.infer<
  typeof structuredBriefEnvelopeSchema
>;

export function encodeStructuredBrief(brief: DailyBrief) {
  return JSON.stringify(
    {
      kind: "x-analyst.daily-brief",
      version: 1,
      brief
    } satisfies StructuredBriefEnvelope,
    null,
    2
  );
}

export function parseStructuredBrief(value: string) {
  try {
    return structuredBriefEnvelopeSchema.parse(normalizeStructuredBrief(JSON.parse(value)));
  } catch {
    return null;
  }
}

function normalizeStructuredBrief(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const envelope = value as {
    brief?: {
      sections?: Array<{
        items?: Array<Record<string, unknown>>;
      }>;
    };
  };

  for (const section of envelope.brief?.sections ?? []) {
    for (const item of section.items ?? []) {
      item.viaHandle ??= "";
      item.viaUrl ??= "";
    }
  }

  return value;
}

export function structuredBriefToMarkdown(brief: DailyBrief) {
  return [
    `# ${brief.title}`,
    "",
    "## BLUF",
    "",
    brief.bluf,
    "",
    ...brief.sections.flatMap((section) => [
      `## ${section.title}`,
      "",
      section.summary ?? "",
      "",
      ...section.items.flatMap((item) => [
        `### ${item.title}`,
        "",
        `- Source: [${item.sourceLabel}](${item.url})`,
        item.viaUrl ? `- via: [${item.viaHandle || "X"}](${item.viaUrl})` : "",
        `- Why it matters: ${item.why}`,
        `- Takeaway: ${item.takeaway}`,
        ""
      ])
    ]),
    brief.followups.length ? "## Suggested Follow-Ups" : "",
    "",
    ...brief.followups.map((followup) => `- ${followup}`)
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}
