"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef } from "react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="shadcn-dialog-overlay" />
      <DialogPrimitive.Content
        className={`shadcn-dialog-content ${className}`}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`shadcn-dialog-header ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={`shadcn-dialog-footer ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={`shadcn-dialog-title ${className}`}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export function DialogDescription({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={`shadcn-dialog-description ${className}`}
      {...props}
    >
      {children}
    </DialogPrimitive.Description>
  );
}
