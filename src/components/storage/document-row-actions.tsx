"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  deleteDocumentAction,
  getDownloadUrlAction,
} from "@/lib/storage/actions";

interface Props {
  documentId: string;
  scanStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR";
  canDelete: boolean;
}

export function DocumentRowActions({
  documentId,
  scanStatus,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pendingDownload, startDownload] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    startDownload(async () => {
      const result = await getDownloadUrlAction(documentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.value.url, "_blank", "noopener,noreferrer");
    });
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteDocumentAction(documentId);
      if (!result.ok) {
        setError(result.error);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {error && (
        <span className="mr-2 text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={download}
        disabled={pendingDownload || scanStatus !== "CLEAN"}
        aria-label="Télécharger le document"
        title={
          scanStatus === "CLEAN"
            ? "Télécharger"
            : scanStatus === "PENDING"
              ? "Scan antivirus en cours"
              : "Document non disponible"
        }
      >
        <Download className="size-4" aria-hidden />
      </Button>
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          disabled={pendingDelete}
          aria-label="Supprimer le document"
          className="text-red-700 hover:bg-red-50"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce document ?"
        description="Le fichier sera supprimé du stockage et ne pourra plus être téléchargé."
        destructive
        confirmLabel="Supprimer"
        pending={pendingDelete}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}
