"use client";

import { useState } from "react";
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

type StarterFieldId =
  | "xListId"
  | "discoveryQueries"
  | "priorityHandles"
  | "interestProfileMd";

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

I use X Analyst to track meaningful AI developments across products, research, companies, and real-world adoption.

## Strong interests

- new AI products, workflows, and capabilities that change what individuals or teams can actually do
- research papers, demos, benchmarks, and technical explainers that indicate a real capability shift
- AI-native applications in writing, design, research, education, healthcare, law, finance, operations, and creative work
- companies and open-source projects with clear product direction, unusual traction, or a distinctive technical approach
- practical reports from builders, researchers, operators, founders, and users showing how AI is being used outside polished demos

## Especially valuable

- a concrete before/after: something became cheaper, faster, easier, more reliable, or newly possible
- primary sources, launch notes, technical posts, public experiments, case studies, or unusually clear threads
- signs of adoption: users changing behavior, teams replacing old workflows, meaningful revenue, or ecosystem pull
- honest discussion of limitations, costs, risks, distribution, or why a product might fail
- developments that suggest where AI products, labor markets, software, media, or business models are heading

## Adjacent interests

- model releases when they unlock a new product pattern or make an existing category materially better
- AI hardware, inference costs, edge deployment, synthetic data, multimodal interfaces, voice, video, and robotics
- regulation, copyright, safety, provenance, security, and social impacts when they affect deployment or adoption
- distribution strategy, pricing, defensibility, UX, and market structure for AI products

## Lower priority

- generic AI hype, vague opinions, recycled announcements, listicles, prompt tricks, and engagement bait
- funding news without a clear product, customer, or technology signal
- model leaderboard movement without practical implications
- repetitive takes about AGI timelines, vague futurism, or culture-war commentary
- shallow product launches that do not explain who uses the product, why it matters, or what changed

## Brief style

Be selective, skeptical, and practical. Prefer fewer, higher-signal items. Explain what changed, why it matters, and what to watch next. Avoid numeric scores and fake objectivity.`;

const starterTemplates: Record<
  StarterFieldId,
  {
    label: string;
    preview: string;
    help?: React.ReactNode;
  }
> = {
  xListId: {
    label: "X list",
    preview: starterListId,
    help: (
      <p>
        Florian's list:{" "}
        <a href={starterListUrl} rel="noreferrer" target="_blank">
          {starterListUrl}
        </a>
      </p>
    )
  },
  discoveryQueries: {
    label: "Discovery queries",
    preview: starterDiscoveryQueries
  },
  priorityHandles: {
    label: "Priority handles",
    preview: starterPriorityHandles
  },
  interestProfileMd: {
    label: "Markdown interest profile",
    preview: starterInterestProfile
  }
};

export function ProfileStarterTemplateButton({
  fieldId
}: {
  fieldId: StarterFieldId;
}) {
  const [hasCurrentValue, setHasCurrentValue] = useState(false);
  const [insertedBecauseEmpty, setInsertedBecauseEmpty] = useState(false);
  const template = starterTemplates[fieldId];

  function handleOpen() {
    const fieldHasValue = hasFieldValue(fieldId);
    setHasCurrentValue(fieldHasValue);
    setInsertedBecauseEmpty(!fieldHasValue);

    if (!fieldHasValue) {
      setFieldValue(fieldId, template.preview, "replace");
    }
  }

  function handleReplace() {
    setFieldValue(fieldId, template.preview, "replace");
    setHasCurrentValue(true);
    setInsertedBecauseEmpty(true);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="secondary-button field-template-button"
          type="button"
          onClick={handleOpen}
        >
          Show template
        </button>
      </DialogTrigger>
      <DialogContent className="starter-template-dialog">
        <DialogHeader>
          <DialogTitle>{template.label} template</DialogTitle>
          <DialogDescription asChild>
            <div className="starter-template-copy">
              {insertedBecauseEmpty ? (
                <p>
                  The field was empty, so this template has been added. Review
                  it below, then edit the field if you want to tune it.
                </p>
              ) : (
                <p>
                  This field already has values. Review the template below, then
                  replace your current values only if you want to.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <StarterFieldPreview
          label={template.label}
          preview={template.preview}
        >
          {template.help}
        </StarterFieldPreview>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              {insertedBecauseEmpty ? "Done" : "Cancel"}
            </button>
          </DialogClose>
          {hasCurrentValue && !insertedBecauseEmpty ? (
            <DialogClose asChild>
              <button
                className="shadcn-button"
                type="button"
                onClick={handleReplace}
              >
                Replace current values
              </button>
            </DialogClose>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StarterFieldPreview({
  label,
  preview,
  children
}: {
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
    </section>
  );
}

function hasFieldValue(id: StarterFieldId) {
  const field = document.getElementById(id);

  if (
    !(
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    )
  ) {
    return false;
  }

  return Boolean(field.value.trim());
}

function setFieldValue(
  id: StarterFieldId,
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
