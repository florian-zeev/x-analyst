"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCollectionItemNote } from "@/app/dashboard/actions";
import type { CollectionNoteState } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/dashboard/SubmitButton";

export function CollectionNoteEditor({
  itemId,
  note
}: {
  itemId: string;
  note: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentNote, setCurrentNote] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, action] = useActionState(updateCollectionItemNote, {
    type: "idle",
    message: "",
    note
  } satisfies CollectionNoteState);

  useEffect(() => {
    if (state.type === "success") {
      setCurrentNote(state.note);
      setIsEditing(false);
    }
  }, [state.note, state.type]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <form action={action} className="collection-note collection-note-editor">
        <input name="collectionItemId" type="hidden" value={itemId} />
        <label>
          <span>Note</span>
          <textarea
            ref={textareaRef}
            defaultValue={currentNote}
            name="note"
            rows={3}
          />
        </label>
        <div className="collection-note-actions">
          <SubmitButton
            className="text-button"
            idleLabel="OK"
            pendingLabel="Saving..."
          />
          <button
            className="text-button"
            type="button"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </button>
        </div>
        {state.type === "error" ? (
          <p className="collection-note-status">{state.message}</p>
        ) : null}
      </form>
    );
  }

  return (
    <section className="collection-note" aria-label="Saved note">
      <div className="collection-note-header">
        <p>Note</p>
        <button
          aria-label="Edit note"
          className="icon-button"
          title="Edit note"
          type="button"
          onClick={() => setIsEditing(true)}
        >
          <PencilIcon />
        </button>
      </div>
      <p className={currentNote ? "" : "muted"}>
        {currentNote || "No note yet."}
      </p>
    </section>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
