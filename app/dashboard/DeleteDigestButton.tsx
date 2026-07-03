"use client";

import { useFormStatus } from "react-dom";
import { deleteDigest } from "@/app/dashboard/actions";
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

export function DeleteDigestButton({
  digestId,
  subject
}: {
  digestId: string;
  subject: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-button danger" type="button">
          Delete
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete brief?</DialogTitle>
          <DialogDescription>
            This will permanently delete “{subject}”. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              Cancel
            </button>
          </DialogClose>
          <form action={deleteDigest}>
            <input name="digestId" type="hidden" value={digestId} />
            <DeleteSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubmitButton() {
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
