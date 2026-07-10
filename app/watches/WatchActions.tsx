"use client";

import {
  Archive,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  X
} from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import {
  changeWatchStatus,
  deleteWatchAction,
  saveWatch
} from "@/app/watches/actions";
import { initialWatchActionState } from "@/app/watches/state";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { watchQueries } from "@/lib/watch-helpers";
import type { Watch } from "@/lib/watches";

export function WatchActions({ watch }: { watch: Watch }) {
  const initialSearches = watchQueries(watch.x_query);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [searches, setSearches] = useState(initialSearches);
  const [editingSearchIndex, setEditingSearchIndex] = useState<number | null>(
    null
  );
  const [saveState, saveAction] = useActionState(
    saveWatch,
    initialWatchActionState
  );
  const [statusState, statusAction] = useActionState(
    changeWatchStatus,
    initialWatchActionState
  );
  const [deleteState, deleteAction] = useActionState(
    deleteWatchAction,
    initialWatchActionState
  );

  useEffect(() => {
    if (saveState.type === "success") {
      setEditing(false);
      setEditingSearchIndex(null);
    }
  }, [saveState]);

  useEffect(() => {
    if (statusState.type === "success") {
      setOpen(false);
    }
  }, [statusState]);

  useEffect(() => {
    if (deleteState.type === "success") {
      setOpen(false);
    }
  }, [deleteState]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setEditing(false);
          setConfirmingDelete(false);
          setSearches(initialSearches);
          setEditingSearchIndex(null);
        }
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                aria-label={`Manage ${watch.title}`}
                className="icon-button watch-menu-trigger"
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={18} />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Manage focus tracker</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className={editing ? "focus-tracker-edit-dialog" : ""}>
        <DialogHeader>
          <DialogTitle>
            {confirmingDelete
              ? "Delete focus tracker?"
              : editing
                ? "Edit focus tracker"
                : watch.title}
          </DialogTitle>
          <DialogDescription>
            {confirmingDelete
              ? "This permanently deletes the focus tracker and its check history. This action cannot be undone."
              : editing
              ? "Keep the query focused enough to recognize a meaningful change."
              : "Change this focus tracker without affecting your general profile sources."}
          </DialogDescription>
        </DialogHeader>

        {confirmingDelete ? (
          <form action={deleteAction}>
            <input name="watchId" type="hidden" value={watch.id} />
            {deleteState.type === "error" ? (
              <p className="inline-error" role="alert">
                {deleteState.message}
              </p>
            ) : null}
            <DialogFooter>
              <button
                className="shadcn-button shadcn-button-outline"
                onClick={() => setConfirmingDelete(false)}
                type="button"
              >
                Cancel
              </button>
              <DeleteWatchSubmit />
            </DialogFooter>
          </form>
        ) : editing ? (
          <form action={saveAction} className="watch-edit-form">
            <input name="watchId" type="hidden" value={watch.id} />
            <label>
              Title
              <input defaultValue={watch.title} name="title" required />
            </label>
            <label>
              Objective
              <textarea
                defaultValue={watch.objective}
                name="objective"
                required
                rows={4}
              />
            </label>
            <input name="xQuery" type="hidden" value={searches.join("\n")} />
            <TooltipProvider>
              <div className="watch-search-editor">
                <div className="watch-search-editor-heading">
                  <span>Search terms</span>
                  <small>Up to three</small>
                </div>
                <p className="watch-search-help">
                  All terms must appear in a post. Put words in quotes to keep
                  them together, for example <code>&quot;agent memory&quot;</code>.
                  Use <code>OR</code> for alternatives.
                </p>
                <div className="watch-search-editor-list">
                  {searches.map((query, index) => (
                    <div className="watch-search-editor-row" key={index}>
                      <div className="watch-search-editor-row-heading">
                        <span>Search {index + 1}</span>
                        <div>
                          <SearchIconButton
                            label={`Edit search ${index + 1}`}
                            onClick={() => setEditingSearchIndex(index)}
                          >
                            <Pencil aria-hidden="true" size={14} />
                          </SearchIconButton>
                          {searches.length > 1 ? (
                            <SearchIconButton
                              label={`Remove search ${index + 1}`}
                              onClick={() => {
                                setSearches((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index)
                                );
                                setEditingSearchIndex(null);
                              }}
                            >
                              <X aria-hidden="true" size={15} />
                            </SearchIconButton>
                          ) : null}
                        </div>
                      </div>
                      {editingSearchIndex === index ? (
                        <>
                          <textarea
                            aria-label={`Exact X query for search ${index + 1}`}
                            onChange={(event) =>
                              setSearches((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? event.target.value : item
                                )
                              )
                            }
                            rows={3}
                            value={query}
                          />
                          <button
                            className="secondary-button watch-search-done"
                            onClick={() => setEditingSearchIndex(null)}
                            type="button"
                          >
                            Done
                          </button>
                        </>
                      ) : (
                        <code className="watch-search-query">{query}</code>
                      )}
                    </div>
                  ))}
                </div>
                {searches.length < 3 ? (
                  <button
                    className="secondary-button watch-add-search"
                    onClick={() => {
                      setSearches((current) => [...current, ""]);
                      setEditingSearchIndex(searches.length);
                    }}
                    type="button"
                  >
                    <Plus aria-hidden="true" size={14} />
                    Add search
                  </button>
                ) : null}
              </div>
            </TooltipProvider>
            {saveState.type === "error" ? (
              <p className="inline-error" role="alert">
                {saveState.message}
              </p>
            ) : null}
            {saveState.type === "success" ? (
              <p className="inline-success" role="status">
                {saveState.message}
              </p>
            ) : null}
            <DialogFooter>
              <button
                className="shadcn-button shadcn-button-outline"
                onClick={() => {
                  setEditing(false);
                  setSearches(initialSearches);
                  setEditingSearchIndex(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <SubmitButton
                className="shadcn-button"
                idleLabel="Save"
                pendingLabel="Saving..."
              />
            </DialogFooter>
          </form>
        ) : (
          <div className="watch-action-menu">
            <button
              className="shadcn-button shadcn-button-outline"
              onClick={() => setEditing(true)}
              type="button"
            >
              Edit
            </button>
            <form action={statusAction}>
              <input name="watchId" type="hidden" value={watch.id} />
              <input
                name="status"
                type="hidden"
                value={watch.status === "active" ? "paused" : "active"}
              />
              <WatchStatusSubmit
                action={watch.status === "active" ? "Pause" : "Resume"}
                icon={watch.status === "active" ? "pause" : "play"}
              />
            </form>
            {watch.status !== "archived" ? (
              <form action={statusAction}>
                <input name="watchId" type="hidden" value={watch.id} />
                <input name="status" type="hidden" value="archived" />
                <WatchStatusSubmit action="Archive" icon="archive" />
              </form>
            ) : null}
            <button
              className="shadcn-button shadcn-button-danger-outline"
              onClick={() => setConfirmingDelete(true)}
              type="button"
            >
              Delete
            </button>
            {statusState.type === "error" || statusState.type === "limit" ? (
              <p className="inline-error" role="alert">
                {statusState.message}
              </p>
            ) : null}
          </div>
        )}

        {!editing && !confirmingDelete ? (
          <DialogFooter>
            <DialogClose asChild>
              <button className="shadcn-button shadcn-button-outline" type="button">
                Close
              </button>
            </DialogClose>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SearchIconButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className="icon-button search-row-icon"
          onClick={onClick}
          type="button"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function DeleteWatchSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className="shadcn-button shadcn-button-danger"
      disabled={pending}
      type="submit"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}

function WatchStatusSubmit({
  action,
  icon
}: {
  action: "Pause" | "Resume" | "Archive";
  icon: "pause" | "play" | "archive";
}) {
  const { pending } = useFormStatus();
  const label = pending
    ? action === "Pause"
      ? "Pausing..."
      : action === "Resume"
        ? "Resuming..."
        : "Archiving..."
    : action;

  return (
    <button
      aria-busy={pending}
      className="shadcn-button shadcn-button-outline"
      disabled={pending}
      type="submit"
    >
      {icon === "pause" ? <Pause aria-hidden="true" size={15} /> : null}
      {icon === "play" ? <Play aria-hidden="true" size={15} /> : null}
      {icon === "archive" ? <Archive aria-hidden="true" size={15} /> : null}
      {label}
    </button>
  );
}
