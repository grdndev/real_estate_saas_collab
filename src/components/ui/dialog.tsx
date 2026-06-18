"use client";

import * as React from "react";
import { X } from "lucide-react";
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
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PreviewDialogProps {
  open: boolean;
  title: string;
  url: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function PreviewDialog({
  open,
  title,
  url,
  loading = false,
  error,
  onClose,
}: PreviewDialogProps) {
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
          onClose();
        }}
        onClick={(e) => {
          if (e.target === ref.current) onClose();
        }}
        className={cn(
          "rounded-lg border border-slate-200 bg-white p-0 shadow-xl",
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[90vw] max-w-5xl",
          "backdrop:bg-equatis-night-900/40 backdrop-blur-sm",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-equatis-night-800 text-lg font-semibold">
            {title}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Fermer la prévisualisation"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="p-4" style={{ height: "75vh" }}>
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Chargement…
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center text-sm text-red-600">
              {error}
            </div>
          )}
          {url && !loading && !error && (
            <iframe
              src={url}
              className="h-full w-full rounded border-0"
              title={title}
            />
          )}
        </div>
      </dialog>
    </div>,
    document.body,
  );
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
  error,
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
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
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
            disabled={pending || !!error}
          >
            {pending ? "…" : confirmLabel}
          </Button>
        </div>
      </dialog>
    </div>,
    document.body,
  );
}
