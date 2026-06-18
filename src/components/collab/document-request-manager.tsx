"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Eye, Trash2, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreviewDialog } from "@/components/ui/dialog";
import {
  acceptDocumentRequestAction,
  cancelDocumentRequestAction,
  refuseDocumentRequestAction,
  requestDocumentAction,
} from "@/lib/client-space/actions";
import {
  getDownloadUrlAction,
  getPreviewUrlAction,
} from "@/lib/storage/actions";

interface RequestItem {
  id: string;
  label: string;
  required: boolean;
  fulfilled: boolean;
  hasDocument: boolean;
  status: "PENDING" | "ACCEPTED" | "REFUSED";
  documentId: string | null;
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

  function accept(requestId: string) {
    setError(null);
    startTransition(async () => {
      const result = await acceptDocumentRequestAction({ requestId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function refuse(requestId: string) {
    setError(null);
    startTransition(async () => {
      const result = await refuseDocumentRequestAction({ requestId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
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
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 py-2${item.status === "REFUSED" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-equatis-night-800 font-medium">
                  {item.label}
                </span>
                {item.required && (
                  <Badge variant="warning" className="text-[10px]">
                    obligatoire
                  </Badge>
                )}
                {item.status === "ACCEPTED" ? (
                  <Badge variant="success" className="text-[10px]">
                    acceptée
                  </Badge>
                ) : item.status === "REFUSED" ? (
                  <Badge variant="danger" className="text-[10px]">
                    refusée
                  </Badge>
                ) : item.fulfilled || item.hasDocument ? (
                  <Badge variant="success" className="text-[10px]">
                    déposée
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="text-[10px]">
                    en attente
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                {item.status === "PENDING" && !item.documentId && (
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

                {item.status === "PENDING" && item.documentId && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPreview(item.documentId!, item.label)}
                      aria-label={`Prévisualiser ${item.label}`}
                    >
                      <Eye className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => download(item.documentId!)}
                      aria-label={`Télécharger ${item.label}`}
                    >
                      <Download className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-700 hover:bg-green-50"
                      onClick={() => accept(item.id)}
                      disabled={pending}
                      aria-label={`Accepter ${item.label}`}
                    >
                      <Check className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => refuse(item.id)}
                      disabled={pending}
                      aria-label={`Refuser ${item.label}`}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </>
                )}

                {(item.status === "ACCEPTED" || item.status === "REFUSED") &&
                  item.documentId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          openPreview(item.documentId!, item.label)
                        }
                        aria-label={`Prévisualiser ${item.label}`}
                      >
                        <Eye className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => download(item.documentId!)}
                        aria-label={`Télécharger ${item.label}`}
                      >
                        <Download className="size-4" aria-hidden />
                      </Button>
                    </>
                  )}
              </div>
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
    </div>
  );
}
