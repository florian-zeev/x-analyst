"use client";

import { useState } from "react";
import { saveArticleFeedback } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import { ReasonSelect } from "@/app/briefs/ReasonSelect";

type FeedbackDirection = "more" | "less";

export function ItemFeedbackForm({
  digestId,
  item
}: {
  digestId: string;
  item: {
    title: string;
    url: string;
    sourceLabel: string;
    viaHandle: string;
    tags: string[];
  };
}) {
  const [direction, setDirection] = useState<FeedbackDirection | null>(null);

  return (
    <form
      action={saveArticleFeedback}
      className={`item-feedback ${direction ? "is-expanded" : "is-collapsed"}`}
    >
      <input name="digestId" type="hidden" value={digestId} />
      <input name="itemUrl" type="hidden" value={item.url} />
      <input name="itemTitle" type="hidden" value={item.title} />
      <input name="sourceLabel" type="hidden" value={item.sourceLabel} />
      <input name="viaHandle" type="hidden" value={item.viaHandle} />
      <input name="tags" type="hidden" value={item.tags.join(",")} />
      {direction ? <input name="direction" type="hidden" value={direction} /> : null}

      {!direction ? (
        <div className="feedback-compact" aria-label="Preference feedback">
          <span>Feedback</span>
          <button className="text-button" type="button" onClick={() => setDirection("more")}>
            More like this
          </button>
          <button
            className="text-button danger"
            type="button"
            onClick={() => setDirection("less")}
          >
            Less like this
          </button>
        </div>
      ) : (
        <>
          <div className="feedback-expanded-head">
            <p className="feedback-title">
              {direction === "more" ? "More like this" : "Less like this"}
            </p>
            <button
              className="text-button feedback-cancel"
              type="button"
              onClick={() => setDirection(null)}
            >
              Cancel
            </button>
          </div>
          <div className="feedback-controls">
            <label>
              Reason
              <ReasonSelect />
            </label>
            <label>
              Note
              <input name="note" placeholder="Optional nuance" />
            </label>
            <div className="feedback-actions" aria-label="Save feedback">
              <SubmitButton
                className="text-button"
                idleLabel="Save feedback"
                pendingLabel="Saving..."
              />
            </div>
          </div>
        </>
      )}
    </form>
  );
}
