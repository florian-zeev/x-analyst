import { z } from "zod";

export const briefItemSchema = z.object({
  title: z.string(),
  sourceLabel: z.string(),
  url: z.string(),
  viaHandle: z.string(),
  viaUrl: z.string(),
  sourceType: z.enum([
    "external",
    "x-native",
    "company",
    "framework",
    "research",
    "organization",
    "project",
    "publication",
    "policy",
    "event",
    "analysis"
  ]),
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

export function structuredBriefToHtml(brief: DailyBrief) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
    <main style="max-width:760px;margin:0 auto;padding:44px 28px;">
      <p style="margin:0 0 10px;color:#686868;font-size:12px;text-transform:uppercase;">X Analyst</p>
      <h1 style="margin:0 0 28px;font-size:34px;line-height:1.12;color:#111111;">${escapeHtml(brief.title)}</h1>
      <section style="border-top:1px solid #b8b8b8;border-bottom:1px solid #e6e6e6;padding:24px 0;margin-bottom:36px;">
        <p style="margin:0 0 10px;color:#686868;font-size:12px;text-transform:uppercase;">BLUF</p>
        <p style="margin:0;font-size:20px;line-height:1.5;color:#111111;">${escapeHtml(brief.bluf)}</p>
      </section>
      ${brief.sections.map(renderEmailSection).join("")}
      ${brief.followups.length ? renderFollowups(brief.followups) : ""}
    </main>
  </body>
</html>`;
}

function renderEmailSection(section: DailyBrief["sections"][number]) {
  return `<section style="display:block;margin:0 0 42px;">
    <div style="border-top:2px solid #111111;padding-top:14px;margin-bottom:22px;">
      <h2 style="margin:0 0 10px;font-size:15px;line-height:1.3;text-transform:uppercase;color:#111111;">${escapeHtml(section.title)}</h2>
      ${section.summary ? `<p style="margin:0;color:#686868;line-height:1.5;">${escapeHtml(section.summary)}</p>` : ""}
    </div>
    ${section.items.map(renderEmailItem).join("")}
  </section>`;
}

function renderEmailItem(item: DailyBrief["sections"][number]["items"][number]) {
  const tags = item.tags
    .map(
      (tag) =>
        `<span style="display:inline-block;border:1px solid #e6e6e6;color:#686868;font-size:12px;padding:3px 7px;margin:0 6px 6px 0;">${escapeHtml(tag)}</span>`
    )
    .join("");

  return `<article style="border-top:1px solid #e6e6e6;padding-top:20px;margin-top:20px;">
    <p style="margin:0 0 8px;color:#686868;font-size:12px;">
      <span style="text-transform:uppercase;">${escapeHtml(sourceTypeLabel(item.sourceType))}</span>
      &nbsp; <a href="${escapeAttribute(item.url)}" style="color:#111111;font-weight:700;text-decoration:underline;">${escapeHtml(item.sourceLabel)}</a>
      ${item.viaUrl ? `&nbsp; via <a href="${escapeAttribute(item.viaUrl)}" style="color:#111111;font-weight:700;text-decoration:underline;">${escapeHtml(item.viaHandle || "X")}</a>` : ""}
    </p>
    <h3 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#111111;">${escapeHtml(item.title)}</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 12px;">
      <tr>
        <td style="width:86px;color:#686868;font-size:12px;text-transform:uppercase;vertical-align:top;padding:0 14px 10px 0;">Why</td>
        <td style="color:#111111;line-height:1.5;padding:0 0 10px;">${escapeHtml(item.why)}</td>
      </tr>
      <tr>
        <td style="width:86px;color:#686868;font-size:12px;text-transform:uppercase;vertical-align:top;padding:0 14px 10px 0;">Takeaway</td>
        <td style="color:#111111;line-height:1.5;padding:0 0 10px;">${escapeHtml(item.takeaway)}</td>
      </tr>
    </table>
    ${tags ? `<div>${tags}</div>` : ""}
  </article>`;
}

function renderFollowups(followups: string[]) {
  return `<section style="border-top:1px solid #e6e6e6;padding-top:24px;margin-top:36px;">
    <h2 style="margin:0 0 12px;font-size:15px;text-transform:uppercase;color:#111111;">Suggested Follow-Ups</h2>
    <ul style="margin:0;padding-left:20px;color:#111111;line-height:1.5;">
      ${followups.map((followup) => `<li>${escapeHtml(followup)}</li>`).join("")}
    </ul>
  </section>`;
}

function sourceTypeLabel(sourceType: string) {
  return sourceType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
