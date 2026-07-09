"use client";

import { useFormStatus } from "react-dom";
import { removeCollectionItem } from "@/app/dashboard/actions";
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

export function RemoveCollectionItemButton({
  itemId,
  title
}: {
  itemId: string;
  title: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-button danger" type="button">
          Remove
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Really remove?</DialogTitle>
          <DialogDescription>
            This will remove “{title}” from your collection. The original brief
            will stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              Cancel
            </button>
          </DialogClose>
          <form action={removeCollectionItem}>
            <input name="collectionItemId" type="hidden" value={itemId} />
            <RemoveSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="shadcn-button shadcn-button-danger"
      disabled={pending}
      type="submit"
    >
      {pending ? "Removing..." : "Remove"}
    </button>
  );
}
