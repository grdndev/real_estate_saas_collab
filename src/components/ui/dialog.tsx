"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
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
        "backdrop:bg-equatis-night-900/40 backdrop:backdrop-blur-sm",
        "w-full max-w-md",
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
  );
}
