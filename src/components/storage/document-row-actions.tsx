"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Trash2, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog, PreviewDialog } from "@/components/ui/dialog";
import {
  deleteDocumentAction,
  getDownloadUrlAction,
  getPreviewUrlAction,
  toggleDocumentVisibilityAction,
} from "@/lib/storage/actions";

interface Props {
  documentId: string;
  scanStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR";
  canDelete: boolean;
  isShared?: boolean;
  source?:
    | "CLIENT_UPLOAD"
    | "COLLABORATOR_UPLOAD"
    | "YOUSIGN_SIGNED"
    | "PROGRAMME_RESOURCE";
}

export function DocumentRowActions({
  documentId,
  scanStatus,
  canDelete,
  isShared,
  source,
}: Props) {
  const router = useRouter();
  const [pendingDownload, startDownload] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [pendingPreview, startPreview] = useTransition();
  const [pendingToggle, startToggle] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function preview() {
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewOpen(true);
    startPreview(async () => {
      const result = await getPreviewUrlAction(documentId);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreviewUrl(result.value.url);
    });
  }

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

  function toggleVisibility() {
    setError(null);
    startToggle(async () => {
      const result = await toggleDocumentVisibilityAction(documentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
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

  const showToggle = source !== undefined && source !== "CLIENT_UPLOAD";

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
        onClick={preview}
        disabled={pendingPreview || scanStatus !== "CLEAN"}
        aria-label="Prévisualiser le document"
        title={
          scanStatus === "CLEAN"
            ? "Prévisualiser"
            : scanStatus === "PENDING"
              ? "Scan antivirus en cours"
              : "Document non disponible"
        }
      >
        <Eye className="size-4" aria-hidden />
      </Button>
      {showToggle && (
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleVisibility}
          disabled={pendingToggle}
          aria-label={isShared ? "Rendre interne" : "Partager avec le client"}
          title={isShared ? "Partagé avec le client" : "Document interne"}
        >
          {isShared ? (
            <UserCheck className="size-4" aria-hidden />
          ) : (
            <UserX className="size-4" aria-hidden />
          )}
        </Button>
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
      <PreviewDialog
        open={previewOpen}
        title="Prévisualisation du document"
        url={previewUrl}
        loading={pendingPreview}
        error={previewError}
        onClose={() => setPreviewOpen(false)}
      />
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
