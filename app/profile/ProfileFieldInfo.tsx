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

export function ProfileFieldInfo({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="field-info-button" aria-label={`${title} information`} type="button">
          <InfoIcon />
        </button>
      </DialogTrigger>
      <DialogContent className="field-info-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="field-info-copy">{children}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button className="shadcn-button shadcn-button-outline" type="button">
              Close
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="16"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
