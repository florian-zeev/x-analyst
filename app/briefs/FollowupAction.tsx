"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/app/dashboard/SubmitButton";
import {
  startWatch,
  undoStartedWatch
} from "@/app/watches/actions";
import {
  initialWatchActionState,
  type WatchActionState
} from "@/app/watches/state";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { FollowupProposal } from "@/lib/brief";

type WatchSummary = {
  id: string;
  title: string;
  relationship?: "started" | "covered";
};

export function FollowupAction({
  activeWatches,
  digestId,
  followup,
  targetWatch
}: {
  activeWatches: WatchSummary[];
  digestId: string;
  followup: FollowupProposal;
  targetWatch: WatchSummary | null;
}) {
  const [startState, startAction] = useActionState(
    startWatch,
    initialWatchActionState
  );
  const [undoState, undoAction] = useActionState(
    undoStartedWatch,
    initialWatchActionState
  );
  const [limitOpen, setLimitOpen] = useState(false);

  useEffect(() => {
    if (startState.type === "limit") {
      setLimitOpen(true);
    }
  }, [startState]);

  return (
    <article className="followup-item" id={`followup-${followup.id}`}>
      <div>
        <h3>{followup.title}</h3>
        {followup.description ? <p>{followup.description}</p> : null}
      </div>

      {!followup.actionable ? null : targetWatch ? (
        <div className="followup-status">
          <span>
            {targetWatch.relationship === "covered"
              ? `Covered by ${targetWatch.title}`
              : "Actively tracking"}
          </span>
          <Link href={`/watches#watch-${targetWatch.id}`}>View focus tracker</Link>
        </div>
      ) : (
        <form action={startAction}>
          <input name="digestId" type="hidden" value={digestId} />
          <input name="followupId" type="hidden" value={followup.id} />
          <SubmitButton
            className="shadcn-button shadcn-button-outline"
            idleLabel="Create focus tracker"
            pendingLabel="Creating..."
          />
        </form>
      )}

      <WatchToast
        state={undoState.type === "idle" ? startState : undoState}
        undoAction={startState.watchId ? undoAction : null}
        watchId={startState.watchId}
      />

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Five active focus trackers</DialogTitle>
            <DialogDescription>
              Pause or archive one before starting another focus tracker.
            </DialogDescription>
          </DialogHeader>
          <div className="watch-limit-list">
            {activeWatches.map((watch) => (
              <p key={watch.id}>{watch.title}</p>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="shadcn-button shadcn-button-outline" type="button">
                Close
              </button>
            </DialogClose>
            <Link className="shadcn-button" href="/watches">
              Manage focus trackers
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function WatchToast({
  state,
  undoAction,
  watchId
}: {
  state: WatchActionState;
  undoAction: ((payload: FormData) => void) | null;
  watchId?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.type === "idle" || state.type === "limit" || !state.message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timeout);
  }, [state.message, state.type]);

  if (!visible || state.type === "idle" || state.type === "limit") {
    return null;
  }

  return (
    <div className={`bottom-toast watch-toast ${state.type}`} role="status">
      <span>{state.message}</span>
      {state.type === "success" && undoAction && watchId ? (
        <form action={undoAction}>
          <input name="watchId" type="hidden" value={watchId} />
          <button className="text-button" type="submit">
            Undo
          </button>
        </form>
      ) : null}
    </div>
  );
}
