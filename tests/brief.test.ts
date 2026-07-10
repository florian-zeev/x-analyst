import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeStructuredBrief,
  parseStructuredBrief,
  type DailyBrief
} from "../lib/brief.ts";

test("parses and upgrades a version-one brief", () => {
  const parsed = parseStructuredBrief(
    JSON.stringify({
      kind: "x-analyst.daily-brief",
      version: 1,
      brief: {
        title: "Daily Brief",
        bluf: "Summary",
        generatedFor: "reader@example.com",
        sections: [
          {
            id: "must-read",
            title: "Must Read",
            summary: "Important items",
            items: [legacyItem()]
          }
        ],
        followups: ["Track durable agent state"]
      }
    })
  );

  assert.equal(parsed?.version, 2);
  assert.deepEqual(parsed?.brief.sections[0]?.items[0]?.watchIds, []);
  assert.equal(parsed?.brief.followups[0]?.actionable, false);
  assert.equal(parsed?.brief.followups[0]?.title, "Track durable agent state");
});

test("round-trips a version-two brief with watch metadata", () => {
  const brief: DailyBrief = {
    title: "Daily Brief",
    bluf: "Summary",
    generatedFor: "reader@example.com",
    sections: [
      {
        id: "watch-updates",
        title: "Watch Updates",
        summary: "Material changes",
        items: [{ ...legacyItem(), watchIds: ["watch-1"] }]
      }
    ],
    followups: [
      {
        id: "followup-1",
        title: "Hosted-agent state",
        description: "Track resumable state announcements on X.",
        watchTitle: "Agent infrastructure",
        watchObjective: "Monitor durable hosted-agent state.",
        xQuery: '"resumable state" agents',
        targetWatchId: null,
        actionable: true
      }
    ]
  };
  const encoded = encodeStructuredBrief(brief, {
    checks: [
      {
        watchId: "watch-1",
        watchTitle: "Agent infrastructure",
        watchObjective: "Monitor durable hosted-agent state.",
        status: "material",
        matchedPostCount: 4,
        sourceUrl: "https://example.com/article",
        headline: "A material update",
        evidenceSummary: "Something changed.",
        errorMessage: ""
      }
    ]
  });
  const parsed = parseStructuredBrief(encoded);

  assert.deepEqual(parsed?.brief, brief);
  assert.equal(parsed?.watchRun.checks[0]?.status, "material");
});

test("normalizes older version-two watch checks", () => {
  const brief: DailyBrief = {
    title: "Daily Brief",
    bluf: "Summary",
    generatedFor: "reader@example.com",
    sections: [],
    followups: []
  };
  const envelope = JSON.parse(
    encodeStructuredBrief(brief, {
      checks: [
        {
          watchId: "watch-1",
          watchTitle: "Agent infrastructure",
          watchObjective: "Track durable state.",
          status: "quiet",
          matchedPostCount: 0,
          sourceUrl: "",
          headline: "",
          evidenceSummary: "",
          errorMessage: ""
        }
      ]
    })
  );
  delete envelope.watchRun.checks[0].watchTitle;
  delete envelope.watchRun.checks[0].watchObjective;
  delete envelope.watchRun.checks[0].matchedPostCount;

  const parsed = parseStructuredBrief(JSON.stringify(envelope));
  assert.equal(parsed?.watchRun.checks[0]?.watchTitle, "Watch");
  assert.equal(parsed?.watchRun.checks[0]?.matchedPostCount, 0);
});

function legacyItem() {
  return {
    title: "A material update",
    sourceLabel: "example.com",
    url: "https://example.com/article",
    viaHandle: "@example",
    viaUrl: "https://x.com/example/status/1",
    sourceType: "external" as const,
    why: "It changes the state of the field.",
    takeaway: "Review the implementation.",
    tags: ["agents"]
  };
}
