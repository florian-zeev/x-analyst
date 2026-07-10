import { z } from "zod";

const sourceTypeSchema = z.enum([
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
]);

export const generatedBriefItemSchema = z.object({
  title: z.string(),
  sourceLabel: z.string(),
  url: z.string(),
  viaHandle: z.string(),
  viaUrl: z.string(),
  sourceType: sourceTypeSchema,
  why: z.string(),
  takeaway: z.string(),
  tags: z.array(z.string()).max(4)
});

export const generatedFollowupProposalSchema = z.object({
  title: z.string(),
  description: z.string(),
  watchTitle: z.string(),
  watchObjective: z.string(),
  xQuery: z.string(),
  targetWatchId: z.string().nullable()
});

export const generatedBriefSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  items: z.array(generatedBriefItemSchema)
});

export const generatedDailyBriefSchema = z.object({
  title: z.literal("Daily Brief"),
  bluf: z.string(),
  generatedFor: z.string(),
  sections: z.array(generatedBriefSectionSchema),
  followups: z.array(generatedFollowupProposalSchema).max(3)
});

export type GeneratedDailyBrief = z.infer<typeof generatedDailyBriefSchema>;

export const briefItemSchema = generatedBriefItemSchema.extend({
  watchIds: z.array(z.string())
});

export const followupProposalSchema = generatedFollowupProposalSchema.extend({
  id: z.string(),
  actionable: z.boolean()
});

export const briefSectionSchema = generatedBriefSectionSchema.extend({
  items: z.array(briefItemSchema)
});

export const dailyBriefSchema = generatedDailyBriefSchema.extend({
  sections: z.array(briefSectionSchema),
  followups: z.array(followupProposalSchema).max(3)
});

export type DailyBrief = z.infer<typeof dailyBriefSchema>;
export type FollowupProposal = z.infer<typeof followupProposalSchema>;

export const watchRunCheckSchema = z.object({
  watchId: z.string(),
  watchTitle: z.string(),
  watchObjective: z.string(),
  status: z.enum(["quiet", "material", "error"]),
  matchedPostCount: z.number().int().nonnegative(),
  sourceUrl: z.string(),
  headline: z.string(),
  evidenceSummary: z.string(),
  errorMessage: z.string()
});

export const watchRunSchema = z.object({
  checks: z.array(watchRunCheckSchema)
});

export type WatchRun = z.infer<typeof watchRunSchema>;
export type WatchRunCheck = z.infer<typeof watchRunCheckSchema>;

type BriefHtmlOptions = {
  watchRun?: WatchRun;
  saveUrlForItem?: (
    item: DailyBrief["sections"][number]["items"][number]
  ) => string | undefined;
  followupUrl?: (followup: FollowupProposal) => string | undefined;
};

const structuredBriefEnvelopeV2Schema = z.object({
  kind: z.literal("x-analyst.daily-brief"),
  version: z.literal(2),
  brief: dailyBriefSchema,
  watchRun: watchRunSchema
});

const legacyBriefItemSchema = generatedBriefItemSchema;
const legacyDailyBriefSchema = z.object({
  title: z.literal("Daily Brief"),
  bluf: z.string(),
  generatedFor: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      items: z.array(legacyBriefItemSchema)
    })
  ),
  followups: z.array(z.string())
});

const structuredBriefEnvelopeV1Schema = z.object({
  kind: z.literal("x-analyst.daily-brief"),
  version: z.literal(1),
  brief: legacyDailyBriefSchema
});

export type StructuredBriefEnvelope = z.infer<
  typeof structuredBriefEnvelopeV2Schema
>;

export function encodeStructuredBrief(
  brief: DailyBrief,
  watchRun: WatchRun = { checks: [] }
) {
  return JSON.stringify(
    {
      kind: "x-analyst.daily-brief",
      version: 2,
      brief,
      watchRun
    } satisfies StructuredBriefEnvelope,
    null,
    2
  );
}

export function parseStructuredBrief(value: string): StructuredBriefEnvelope | null {
  try {
    const parsed = normalizeStructuredBrief(JSON.parse(value));
    const v2 = structuredBriefEnvelopeV2Schema.safeParse(parsed);
    if (v2.success) {
      return v2.data;
    }

    const v1 = structuredBriefEnvelopeV1Schema.safeParse(parsed);
    if (!v1.success) {
      return null;
    }

    return upgradeLegacyEnvelope(v1.data);
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
      if ((value as { version?: number }).version === 2) {
        item.watchIds ??= [];
      }
    }
  }

  const watchRun = (value as {
    watchRun?: { checks?: Array<Record<string, unknown>> };
  }).watchRun;
  for (const check of watchRun?.checks ?? []) {
    check.watchTitle ??= "Watch";
    check.watchObjective ??= "";
    check.matchedPostCount ??= 0;
  }

  return value;
}

function upgradeLegacyEnvelope(
  envelope: z.infer<typeof structuredBriefEnvelopeV1Schema>
): StructuredBriefEnvelope {
  return {
    kind: "x-analyst.daily-brief",
    version: 2,
    brief: {
      ...envelope.brief,
      sections: envelope.brief.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({ ...item, watchIds: [] }))
      })),
      followups: envelope.brief.followups.slice(0, 3).map((followup, index) => ({
        id: `legacy-${index}`,
        title: followup,
        description: "",
        watchTitle: "",
        watchObjective: "",
        xQuery: "",
        targetWatchId: null,
        actionable: false
      }))
    },
    watchRun: { checks: [] }
  };
}

export function structuredBriefToMarkdown(
  brief: DailyBrief,
  watchRun: WatchRun = { checks: [] }
) {
  return [
    `# ${brief.title}`,
    "",
    "## Summary",
    "",
    brief.bluf,
    "",
    ...(watchRun.checks.length
      ? [
          "## Focus trackers",
          "",
          ...watchRun.checks.flatMap((check) => [
            `### ${check.watchTitle}`,
            "",
            check.status === "material"
              ? `- New signal: [${check.headline}](${check.sourceUrl})`
              : check.status === "error"
                ? `- Check failed: ${check.errorMessage}`
                : `- No material change: ${check.evidenceSummary || "No material change since the previous check."}`,
            ""
          ])
        ]
      : []),
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
    ...brief.followups.map((followup) =>
      `- ${followup.title}${followup.description ? `: ${followup.description}` : ""}`
    )
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}

export function structuredBriefToHtml(
  brief: DailyBrief,
  options: BriefHtmlOptions = {}
) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <main style="max-width:640px;margin:0 auto;padding:28px 18px 36px;">
      <p style="margin:0 0 8px;color:#686868;font-size:11px;line-height:1.3;text-transform:uppercase;">X Analyst</p>
      <h1 style="margin:0 0 22px;font-size:28px;line-height:1.12;color:#111111;">${escapeHtml(brief.title)}</h1>
      <section style="padding:4px 0 12px;margin-bottom:34px;">
        <p style="margin:0 0 8px;color:#686868;font-size:11px;line-height:1.3;text-transform:uppercase;">Summary</p>
        <p style="margin:0;font-size:16px;line-height:1.58;color:#111111;">${escapeHtml(brief.bluf)}</p>
      </section>
      ${options.watchRun?.checks.length ? renderEmailWatchReport(options.watchRun) : ""}
      ${brief.sections.map((section) => renderEmailSection(section, options)).join("")}
      ${brief.followups.length ? renderFollowups(brief.followups, options) : ""}
    </main>
  </body>
</html>`;
}

function renderEmailWatchReport(watchRun: WatchRun) {
  const materialCount = watchRun.checks.filter(
    (check) => check.status === "material"
  ).length;
  return `<section style="display:block;margin:0 0 42px;">
    <h2 style="margin:0 0 6px;font-size:20px;line-height:1.2;color:#111111;">Focus trackers</h2>
    <p style="margin:0 0 16px;color:#686868;font-size:13px;line-height:1.4;">${watchRun.checks.length} focus tracker${watchRun.checks.length === 1 ? "" : "s"} · ${materialCount > 0 ? `${materialCount} new signal${materialCount === 1 ? "" : "s"}` : "No new signals"}</p>
    ${watchRun.checks
      .map((check) => {
        const status =
          check.status === "material"
            ? "New signal"
            : check.status === "error"
              ? "Check failed"
              : "No material change";
        const detail =
          check.status === "material" && check.sourceUrl
            ? `<a href="${escapeAttribute(check.sourceUrl)}" style="color:#111111;font-size:14px;font-weight:700;line-height:1.45;text-decoration:underline;">${escapeHtml(check.headline)}</a>`
            : check.status === "error"
              ? `<span style="color:#b42318;font-size:14px;line-height:1.45;">${escapeHtml(check.errorMessage)}</span>`
              : `<span style="color:#686868;font-size:14px;line-height:1.45;">${escapeHtml(check.evidenceSummary || "No material change since the previous check.")}</span>`;
        return `<div style="background:#f6f6f6;margin:0 0 8px;padding:13px 14px;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;line-height:1.35;">${escapeHtml(check.watchTitle)}</p>
          <p style="margin:0 0 6px;color:#686868;font-size:13px;line-height:1.4;">${escapeHtml(check.watchObjective)}</p>
          <p style="margin:0;"><span style="color:${check.status === "material" ? "#137a36" : check.status === "error" ? "#b42318" : "#686868"};font-size:10px;text-transform:uppercase;">${status}</span><br>${detail}</p>
        </div>`;
      })
      .join("")}
  </section>`;
}

function renderEmailSection(
  section: DailyBrief["sections"][number],
  options: BriefHtmlOptions
) {
  return `<section style="display:block;margin:0 0 42px;">
    <div style="margin-bottom:18px;">
      <h2 style="margin:0 0 10px;font-size:20px;line-height:1.12;text-transform:uppercase;color:#111111;">${escapeHtml(section.title)}</h2>
      ${section.summary ? `<p style="margin:0;color:#686868;font-size:15px;line-height:1.48;">${escapeHtml(section.summary)}</p>` : ""}
    </div>
    ${section.items.map((item) => renderEmailItem(item, options)).join("")}
  </section>`;
}

function renderEmailItem(
  item: DailyBrief["sections"][number]["items"][number],
  options: BriefHtmlOptions
) {
  const saveUrl = options.saveUrlForItem?.(item);

  return `<article style="padding-top:0;margin-top:28px;">
    <p style="margin:0 0 8px;color:#686868;font-size:12px;line-height:1.45;">
      <span style="text-transform:uppercase;">${escapeHtml(sourceTypeLabel(item.sourceType))}</span>
      &nbsp; <a href="${escapeAttribute(item.url)}" style="color:#111111;font-weight:700;text-decoration:underline;text-underline-offset:2px;">${escapeHtml(item.sourceLabel)}</a>
      ${item.viaUrl ? `&nbsp; via <a href="${escapeAttribute(item.viaUrl)}" style="color:#111111;font-weight:700;text-decoration:underline;">${escapeHtml(item.viaHandle || "X")}</a>` : ""}
    </p>
    <h3 style="margin:0 0 16px;font-size:19px;line-height:1.28;color:#111111;">${escapeHtml(item.title)}</h3>
    <div style="margin:0 0 14px;">
      <p style="margin:0 0 5px;color:#686868;font-size:11px;line-height:1.3;text-transform:uppercase;">Why</p>
      <p style="margin:0;color:#111111;font-size:16px;line-height:1.55;">${escapeHtml(item.why)}</p>
    </div>
    <div style="margin:0 0 18px;">
      <p style="margin:0 0 5px;color:#686868;font-size:11px;line-height:1.3;text-transform:uppercase;">Takeaway</p>
      <p style="margin:0;color:#111111;font-size:16px;line-height:1.55;">${escapeHtml(item.takeaway)}</p>
    </div>
    <p style="margin:0;">
      <a href="${escapeAttribute(item.url)}" style="display:inline-block;background:#f1f1f1;color:#111111;font-size:12px;font-weight:700;line-height:1.2;padding:9px 11px;text-decoration:none;text-transform:uppercase;">Read source</a>
      ${saveUrl ? `&nbsp; <a href="${escapeAttribute(saveUrl)}" style="display:inline-block;background:#f1f1f1;color:#111111;font-size:12px;font-weight:700;line-height:1.2;padding:9px 11px;text-decoration:none;text-transform:uppercase;">Save</a>` : ""}
    </p>
  </article>`;
}

function renderFollowups(
  followups: FollowupProposal[],
  options: BriefHtmlOptions
) {
  return `<section style="padding-top:2px;margin-top:34px;">
    <h2 style="margin:0 0 16px;font-size:20px;line-height:1.12;text-transform:uppercase;color:#111111;">Suggested Follow-Ups</h2>
    ${followups
      .map((followup) => {
        const href = options.followupUrl?.(followup);
        return `<div style="margin:0 0 18px;">
          <p style="margin:0 0 5px;font-size:16px;font-weight:700;line-height:1.4;">${escapeHtml(followup.title)}</p>
          ${followup.description ? `<p style="margin:0 0 9px;color:#555555;font-size:15px;line-height:1.5;">${escapeHtml(followup.description)}</p>` : ""}
          ${href && followup.actionable ? `<a href="${escapeAttribute(href)}" style="color:#111111;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:3px;">Open brief</a>` : ""}
        </div>`;
      })
      .join("")}
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
