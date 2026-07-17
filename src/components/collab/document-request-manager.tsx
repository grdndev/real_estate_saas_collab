"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Eye, Trash2, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, PreviewDialog } from "@/components/ui/dialog";
import {
  acceptDocumentAction,
  cancelDocumentRequestAction,
  refuseDocumentAction,
  requestDocumentAction,
} from "@/lib/client-space/actions";
import {
  getDownloadUrlAction,
  getPreviewUrlAction,
} from "@/lib/storage/actions";

type ReviewStatus = "PENDING" | "ACCEPTED" | "REFUSED";

interface RequestDocument {
  id: string;
  fileName: string;
  reviewStatus: ReviewStatus;
  reviewReason: string | null;
}

interface RequestItem {
  id: string;
  label: string;
  required: boolean;
  fulfilled: boolean;
  hasDocument: boolean;
  status: "PENDING" | "ACCEPTED" | "REFUSED";
  documents: RequestDocument[];
}

interface Props {
  dossierId: string;
  initial: RequestItem[];
}

export function DocumentRequestManager({ dossierId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [refuseTarget, setRefuseTarget] = useState<RequestDocument | null>(
    null,
  );
  const [refuseReason, setRefuseReason] = useState("");

  function add() {
    if (label.trim().length < 2) return;
    setError(null);
    startTransition(async () => {
      const result = await requestDocumentAction({
        dossierId,
        label: label.trim(),
        required,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLabel("");
      router.refresh();
    });
  }

  function cancel(requestId: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelDocumentRequestAction({ requestId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function accept(documentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await acceptDocumentAction({ documentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function refuse(documentId: string, reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await refuseDocumentAction({ documentId, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRefuseTarget(null);
      setRefuseReason("");
      router.refresh();
    });
  }

  async function openPreview(documentId: string, title: string) {
    setPreviewTitle(title);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    const result = await getPreviewUrlAction(documentId);
    setPreviewLoading(false);
    if (result.ok) {
      setPreviewUrl(result.value.url);
    } else {
      setPreviewError(result.error);
    }
  }

  async function download(documentId: string) {
    const result = await getDownloadUrlAction(documentId);
    if (result.ok) {
      window.open(result.value.url, "_blank", "noopener,noreferrer");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {initial.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune pièce demandée pour ce dossier.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {initial.map((item) => (
            <li key={item.id} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-equatis-night-800 font-medium">
                    {item.label}
                  </span>
                  {item.required && (
                    <Badge variant="warning" className="text-[10px]">
                      obligatoire
                    </Badge>
                  )}
                  {item.documents.length === 0 && (
                    <Badge variant="neutral" className="text-[10px]">
                      en attente
                    </Badge>
                  )}
                </div>

                {item.documents.length === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    onClick={() => cancel(item.id)}
                    disabled={pending}
                    aria-label={`Supprimer la demande ${item.label}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>

              {item.documents.length > 0 && (
                <ul className="mt-2 space-y-1.5 pl-1">
                  {item.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className={`flex flex-wrap items-center justify-between gap-2 ${doc.reviewStatus === "REFUSED" ? "opacity-60" : ""}`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 truncate font-mono text-xs text-slate-600">
                          {doc.fileName}
                        </span>
                        {doc.reviewStatus === "ACCEPTED" ? (
                          <Badge variant="success" className="text-[10px]">
                            acceptée
                          </Badge>
                        ) : doc.reviewStatus === "REFUSED" ? (
                          <Badge
                            variant="danger"
                            className="text-[10px]"
                            title={doc.reviewReason ?? undefined}
                          >
                            refusée
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">
                            à revoir
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPreview(doc.id, doc.fileName)}
                          aria-label={`Prévisualiser ${doc.fileName}`}
                        >
                          <Eye className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => download(doc.id)}
                          aria-label={`Télécharger ${doc.fileName}`}
                        >
                          <Download className="size-4" aria-hidden />
                        </Button>
                        {doc.reviewStatus !== "ACCEPTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-700 hover:bg-green-50"
                            onClick={() => accept(doc.id)}
                            disabled={pending}
                            aria-label={`Accepter ${doc.fileName}`}
                          >
                            <Check className="size-4" aria-hidden />
                          </Button>
                        )}
                        {doc.reviewStatus !== "REFUSED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setRefuseTarget(doc);
                              setRefuseReason("");
                            }}
                            disabled={pending}
                            aria-label={`Refuser ${doc.fileName}`}
                          >
                            <X className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={`req-label-${dossierId}`}
            className="text-equatis-night-800 mb-1.5 block text-xs font-medium"
          >
            Libellé de la pièce
          </label>
          <Input
            id={`req-label-${dossierId}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : pièce d'identité (recto)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-xs sm:pb-2.5">
          <input
            type="checkbox"
            className="text-equatis-turquoise-600 size-4 rounded border-slate-300"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Obligatoire
        </label>
        <Button
          onClick={add}
          disabled={pending || label.trim().length < 2}
          className="sm:mb-0"
        >
          Ajouter
        </Button>
      </div>

      <PreviewDialog
        open={previewOpen}
        title={previewTitle}
        url={previewUrl}
        loading={previewLoading}
        error={previewError}
        onClose={() => setPreviewOpen(false)}
      />
      <ConfirmDialog
        open={refuseTarget !== null}
        title={`Refuser « ${refuseTarget?.fileName} »`}
        destructive
        pending={pending}
        confirmLabel="Refuser"
        description={
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
            rows={3}
            placeholder="Raison du refus (visible par le client)"
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
          />
        }
        onConfirm={() =>
          refuseTarget && refuse(refuseTarget.id, refuseReason.trim())
        }
        onCancel={() => setRefuseTarget(null)}
      />
    </div>
  );
}
