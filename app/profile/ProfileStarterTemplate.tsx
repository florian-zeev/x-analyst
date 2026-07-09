"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

const starterListId = "1744772823090925584";
const starterListUrl = `https://x.com/i/lists/${starterListId}`;

const starterDiscoveryQueries = [
  "AI agents infrastructure",
  "AI coding agents",
  "AI developer tools launch",
  "agent framework open source",
  "LLM app framework",
  "AI evals benchmark",
  "agent security prompt injection",
  "model context protocol",
  "AI workflow automation",
  "AI reliability observability",
  "structured outputs LLM",
  "AI systems engineering",
  "AI product launch",
  "new AI research paper",
  "frontier model capabilities"
].join("\n");

const starterPriorityHandles = [
  "@karpathy",
  "@sama",
  "@rauchg",
  "@shadcn",
  "@swyx"
].join("\n");

const starterInterestProfile = `# Interest profile

I use X Analyst to find high-signal developments from X and the open web before they become obvious.

## Strong interests

- concrete AI product launches, developer tools, frameworks, research, standards, and infrastructure shifts
- AI agents, coding agents, agent orchestration, tool use, long-running workflows, memory, evals, observability, and reliability
- primary sources, technical writeups, changelogs, research papers, practitioner reports, and detailed product notes
- developments with implications for software engineering, knowledge work, systems engineering, regulated workflows, or complex enterprise deployment
- new companies, open-source projects, or software frameworks that look technically substantive rather than merely well-marketed

## Especially valuable

- something genuinely new, surprising, or newly practical
- evidence of real adoption, usage, benchmark movement, or production deployment
- details about architecture, constraints, tradeoffs, failure modes, or developer workflow
- clear implications for what to build, buy, study, avoid, or monitor next
- concise explanations of why a launch, paper, company, post, or thread matters now

## Adjacent interests

- AI security, prompt injection, sandboxing, provenance, auditability, and human review
- retrieval, knowledge graphs, citations, source-grounded reasoning, and structured extraction
- robotics, autonomy, defense tech, aerospace, safety, compliance, and mission-critical software when AI changes the workflow
- product strategy, go-to-market, ecosystem shifts, and developer adoption signals when tied to concrete technology

## Lower priority

- generic AI hype, vague opinions, recycled announcements, listicles, prompt tricks, and engagement bait
- funding news without product or technical substance
- model leaderboard news unless it changes what can be built or deployed
- consumer apps without a serious technical, workflow, or market signal

## Brief style

Be skeptical, concise, and concrete. Prefer fewer, better items. Explain why each item matters. Avoid numeric scores and fake objectivity.`;

export function ProfileStarterTemplate() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="secondary-button" type="button">
          Use starter profile
        </button>
      </DialogTrigger>
      <DialogContent className="starter-template-dialog">
        <DialogHeader>
          <DialogTitle>Starter profile</DialogTitle>
          <DialogDescription asChild>
            <div className="starter-template-copy">
              <p>
                A cold-start pack for AI and software intelligence. It includes
                Florian's X list, discovery queries, priority handles, and a
                Markdown interest profile.
              </p>
              <p>
                Starter list:{" "}
                <a href={starterListUrl} rel="noreferrer" target="_blank">
                  {starterListUrl}
                </a>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="starter-template-preview">
          <div>
            <span>X list</span>
            <p>{starterListId}</p>
          </div>
          <div>
            <span>Discovery queries</span>
            <p>{starterDiscoveryQueries.split("\n").length} starter queries</p>
          </div>
          <div>
            <span>Priority handles</span>
            <p>{starterPriorityHandles.split("\n").join(", ")}</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              Cancel
            </button>
          </DialogClose>
          <DialogClose asChild>
            <button
              className="shadcn-button shadcn-button-outline"
              type="button"
              onClick={() => applyStarterTemplate("empty")}
            >
              Fill empty fields
            </button>
          </DialogClose>
          <DialogClose asChild>
            <button
              className="shadcn-button"
              type="button"
              onClick={() => applyStarterTemplate("replace")}
            >
              Replace fields
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function applyStarterTemplate(mode: "empty" | "replace") {
  setFieldValue("xListId", starterListId, mode);
  setFieldValue("discoveryQueries", starterDiscoveryQueries, mode);
  setFieldValue("priorityHandles", starterPriorityHandles, mode);
  setFieldValue("interestProfileMd", starterInterestProfile, mode);
}

function setFieldValue(
  id: "xListId" | "discoveryQueries" | "priorityHandles" | "interestProfileMd",
  value: string,
  mode: "empty" | "replace"
) {
  const field = document.getElementById(id);

  if (
    !(
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    )
  ) {
    return;
  }

  if (mode === "empty" && field.value.trim()) {
    return;
  }

  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}
