"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  removeCollectionItemInline,
  saveCollectionItemInline
} from "@/app/dashboard/actions";
import type {
  CollectionRemoveState,
  CollectionSaveState
} from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

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
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [toastState, setToastState] = useState<
    CollectionSaveState | CollectionRemoveState
  >(initialState);
  const rootRef = useRef<HTMLDivElement>(null);
  const [saveState, formAction] = useActionState(
    saveCollectionItemInline,
    initialState
  );
  const [removeState, removeFormAction] = useActionState(
    removeCollectionItemInline,
    initialState
  );

  useEffect(() => {
    if (saveState.type !== "idle") {
      setToastState(saveState);
    }

    if (saveState.type === "success") {
      setIsSaved(true);
      rootRef.current?.closest(".brief-item")?.classList.add("is-saved");
      setIsOpen(false);
    }
  }, [saveState.message, saveState.type]);

  useEffect(() => {
    if (removeState.type !== "idle") {
      setToastState(removeState);
    }

    if (removeState.type === "success") {
      setIsSaved(false);
      rootRef.current?.closest(".brief-item")?.classList.remove("is-saved");
      setIsRemoveOpen(false);
    }
  }, [removeState.message, removeState.type]);

  if (!isOpen) {
    return (
      <div className="bookmark-root" ref={rootRef}>
        <Dialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
          <button
            aria-label={isSaved ? "Remove from collection" : "Save to collection"}
            aria-pressed={isSaved}
            className={`bookmark-button ${isSaved ? "is-saved" : ""}`}
            title={isSaved ? "Remove from collection" : "Save to collection"}
            type="button"
            onClick={() => {
              if (isSaved) {
                setIsRemoveOpen(true);
              } else {
                setIsOpen(true);
              }
            }}
          >
            <BookmarkIcon filled={isSaved} />
          </button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Really remove?</DialogTitle>
              <DialogDescription>
                This will remove the item from your collection. The brief itself
                will stay unchanged.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <button className="shadcn-button shadcn-button-outline" type="button">
                  Cancel
                </button>
              </DialogClose>
              <form action={removeFormAction}>
                <input name="digestId" type="hidden" value={digestId} />
                <input name="itemUrl" type="hidden" value={itemUrl} />
                <SubmitButton
                  className="shadcn-button shadcn-button-danger"
                  idleLabel="Remove"
                  pendingLabel="Removing..."
                />
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <BookmarkToast state={toastState} />
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
        <BookmarkToast state={toastState} />
      </form>
    </div>
  );
}

function BookmarkToast({
  state
}: {
  state: CollectionSaveState | CollectionRemoveState;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (state.type === "idle" || !state.message) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [state.message, state.type]);

  if (state.type === "idle" || !state.message || !isVisible) {
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
