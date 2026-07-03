"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  className,
  idleLabel,
  pendingLabel
}: {
  className: string;
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className={className}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
