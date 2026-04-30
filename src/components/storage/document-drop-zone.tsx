"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  confirmUploadAction,
  prepareUploadAction,
} from "@/lib/storage/actions";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/storage/schemas";
import { cn } from "@/lib/utils";

const ALLOWED_LABEL = "PDF, JPG, PNG, DOCX — max 20 Mo";
const ALLOWED_MIME_LIST: string[] = [...ALLOWED_MIME];
const ACCEPT_ATTR = ALLOWED_MIME_LIST.join(",");

type Source = "CLIENT_UPLOAD" | "COLLABORATOR_UPLOAD";

interface Props {
  dossierId: string;
  documentRequestId?: string;
  source: Source;
  label?: string;
  compact?: boolean;
}

export function DocumentDropZone({
  dossierId,
  documentRequestId,
  source,
  label,
  compact = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  function validate(file: File): string | null {
    if (!ALLOWED_MIME_LIST.includes(file.type)) {
      return "Format non autorisé. Acceptés : " + ALLOWED_LABEL;
    }
    if (file.size > MAX_FILE_BYTES) {
      return "Fichier trop volumineux (max 20 Mo).";
    }
    return null;
  }

  function handleFile(file: File) {
    setError(null);
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    startTransition(async () => {
      setProgress("Préparation…");
      const prepared = await prepareUploadAction({
        dossierId,
        documentRequestId: documentRequestId ?? null,
        fileName: file.name,
        mimeType: file.type as (typeof ALLOWED_MIME)[number],
        sizeBytes: file.size,
        source,
      });
      if (!prepared.ok) {
        setError(prepared.error);
        setProgress(null);
        return;
      }
      setProgress("Envoi du fichier…");
      try {
        const response = await fetch(prepared.value.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!response.ok) {
          throw new Error(`Échec upload (${response.status})`);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Échec de l'envoi du fichier vers le stockage.",
        );
        setProgress(null);
        return;
      }
      setProgress("Validation…");
      const confirmed = await confirmUploadAction({
        documentId: prepared.value.documentId,
      });
      if (!confirmed.ok) {
        setError(confirmed.error);
        setProgress(null);
        return;
      }
      setProgress(null);
      router.refresh();
    });
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={cn(
        "rounded-md border-2 border-dashed transition",
        compact ? "px-3 py-3" : "px-6 py-10",
        dragOver
          ? "border-equatis-turquoise-500 bg-equatis-turquoise-50"
          : "border-slate-300 bg-slate-50/40",
        pending && "opacity-70",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "flex items-center gap-3",
          compact ? "" : "flex-col text-center",
        )}
      >
        {pending ? (
          <Loader2
            aria-hidden
            className={cn(
              "text-equatis-turquoise-600 animate-spin",
              compact ? "size-5" : "size-8",
            )}
          />
        ) : (
          <CloudUpload
            aria-hidden
            className={cn(
              "text-equatis-night-700",
              compact ? "size-5" : "size-8",
            )}
          />
        )}
        <div className={cn("flex-1", compact ? "" : "")}>
          {label && (
            <p className="text-equatis-night-800 text-sm font-medium">
              {label}
            </p>
          )}
          <p className={cn(compact ? "text-xs text-slate-600" : "text-sm")}>
            {progress ?? (
              <>
                Glissez-déposez un fichier ou{" "}
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={pending}
                  className="text-equatis-turquoise-700 font-medium hover:underline"
                >
                  parcourez
                </button>
              </>
            )}
          </p>
          {!compact && (
            <p className="mt-1 text-xs text-slate-500">{ALLOWED_LABEL}</p>
          )}
        </div>
        {!compact && (
          <Button
            variant="outline"
            type="button"
            onClick={pickFile}
            disabled={pending}
          >
            Choisir un fichier
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="danger" role="alert" className="mt-3">
          <span className="flex items-center gap-2">
            <X className="size-4" aria-hidden /> {error}
          </span>
        </Alert>
      )}
    </div>
  );
}
