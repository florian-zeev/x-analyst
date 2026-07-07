"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveCollectionItemInline } from "@/app/dashboard/actions";
import type { CollectionSaveState } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";

const initialState: CollectionSaveState = {
  type: "idle",
  message: ""
};

export function BookmarkForm({
  digestId,
  initialSaved,
  itemUrl
}: {
  digestId: string;
  initialSaved: boolean;
  itemUrl: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(
    saveCollectionItemInline,
    initialState
  );

  useEffect(() => {
    if (state.type === "success") {
      setIsSaved(true);
      rootRef.current?.closest(".brief-item")?.classList.add("is-saved");
      setIsOpen(false);
    }
  }, [state.type]);

  if (!isOpen) {
    return (
      <div className="bookmark-root" ref={rootRef}>
        <button
          aria-label={isSaved ? "Saved to collection" : "Save to collection"}
          aria-pressed={isSaved}
          className={`bookmark-button ${isSaved ? "is-saved" : ""}`}
          title={isSaved ? "Saved to collection" : "Save to collection"}
          type="button"
          onClick={() => setIsOpen(true)}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
        <BookmarkToast state={state} />
      </div>
    );
  }

  return (
    <div className="bookmark-root" ref={rootRef}>
      <form action={formAction} className="bookmark-form">
        <input name="digestId" type="hidden" value={digestId} />
        <input name="itemUrl" type="hidden" value={itemUrl} />
        <label>
          Save note
          <input name="note" placeholder="Why this is worth keeping" />
        </label>
        <div className="bookmark-actions">
          <SubmitButton
            className="text-button"
            idleLabel="Save"
            pendingLabel="Saving..."
          />
          <button
            className="text-button"
            type="button"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </button>
        </div>
        <BookmarkToast state={state} />
      </form>
    </div>
  );
}

function BookmarkToast({
  state
}: {
  state: CollectionSaveState;
}) {
  if (state.type === "idle" || !state.message) {
    return null;
  }

  return (
    <p className={`bottom-toast ${state.type}`} role="status">
      {state.message}
    </p>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      height="17"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="17"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
