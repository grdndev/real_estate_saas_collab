"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modale de confirmation pour actions destructives (CDC §8.3).
 * Utilise <dialog> natif pour accessibilité (focus trap, esc).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div>
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          onCancel();
        }}
        onClick={(e) => {
          // Click on backdrop closes
          if (e.target === ref.current) onCancel();
        }}
        className={cn(
          "rounded-lg border border-slate-200 bg-white p-0 shadow-xl",
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "backdrop:bg-equatis-night-900/40 backdrop-blur-sm",
        )}
      >
        <div className="px-6 py-5">
          <h2 className="text-equatis-night-800 text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <div className="mt-2 text-sm text-slate-600">{description}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "…" : confirmLabel}
          </Button>
        </div>
      </dialog>
    </div>,
    document.body,
  );
}
