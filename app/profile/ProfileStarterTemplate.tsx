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
          Show starter profile
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
        <div className="starter-template-fields">
          <StarterFieldPreview
            fieldId="xListId"
            label="X list"
            preview={starterListId}
          >
            <p>
              Florian's list:{" "}
              <a href={starterListUrl} rel="noreferrer" target="_blank">
                {starterListUrl}
              </a>
            </p>
          </StarterFieldPreview>
          <StarterFieldPreview
            fieldId="discoveryQueries"
            label="Discovery queries"
            preview={starterDiscoveryQueries}
          />
          <StarterFieldPreview
            fieldId="priorityHandles"
            label="Priority handles"
            preview={starterPriorityHandles}
          />
          <StarterFieldPreview
            fieldId="interestProfileMd"
            label="Markdown interest profile"
            preview={starterInterestProfile}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              Done
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StarterFieldPreview({
  fieldId,
  label,
  preview,
  children
}: {
  fieldId: "xListId" | "discoveryQueries" | "priorityHandles" | "interestProfileMd";
  label: string;
  preview: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="starter-template-field">
      <div className="starter-template-field-header">
        <span>{label}</span>
        {children}
      </div>
      <div className="starter-template-preview-label">Preview</div>
      <pre>{preview}</pre>
      <div className="starter-template-actions" aria-label={`${label} starter actions`}>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setFieldValue(fieldId, preview, "empty")}
        >
          Use if empty
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setFieldValue(fieldId, preview, "replace")}
        >
          Replace this field
        </button>
      </div>
    </section>
  );
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
