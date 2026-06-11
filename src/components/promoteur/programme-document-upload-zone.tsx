"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  confirmProgrammeDocumentUploadAction,
  prepareProgrammeDocumentUploadAction,
} from "@/lib/promoter/actions";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/storage/schemas";
import { cn } from "@/lib/utils";
import type { ProgrammeDocumentCategory } from "@/generated/prisma/enums";

const ALLOWED_MIME_LIST: string[] = [...ALLOWED_MIME];
const ACCEPT_ATTR = ALLOWED_MIME_LIST.join(",");

const CATEGORIES: { value: ProgrammeDocumentCategory; label: string }[] = [
  { value: "PLAN", label: "Plan" },
  { value: "PERMIS", label: "Permis" },
  { value: "NOTICE", label: "Notice" },
  { value: "BUDGET", label: "Budget" },
  { value: "ACTE", label: "Acte" },
];

interface Props {
  programmeId: string;
}

export function ProgrammeDocumentUploadZone({ programmeId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState<ProgrammeDocumentCategory>("PLAN");
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    if (!ALLOWED_MIME_LIST.includes(file.type)) {
      return "Format non autorisé. Acceptés : PDF, JPG, PNG, DOCX.";
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
      const prepared = await prepareProgrammeDocumentUploadAction({
        programmeId,
        category,
        fileName: file.name,
        mimeType: file.type as (typeof ALLOWED_MIME)[number],
        sizeBytes: file.size,
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
        if (!response.ok) throw new Error(`Échec upload (${response.status})`);
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
      const confirmed = await confirmProgrammeDocumentUploadAction(
        prepared.value.documentId,
      );
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm font-medium transition",
              category === cat.value
                ? "border-equatis-turquoise-500 bg-equatis-turquoise-50 text-equatis-turquoise-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

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
          "rounded-md border-2 border-dashed px-6 py-8 transition",
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
        <div className="flex flex-col items-center gap-3 text-center">
          {pending ? (
            <Loader2
              aria-hidden
              className="text-equatis-turquoise-600 size-8 animate-spin"
            />
          ) : (
            <CloudUpload
              aria-hidden
              className="text-equatis-night-700 size-8"
            />
          )}
          <p className="text-sm text-slate-600">
            {progress ?? (
              <>
                Glissez-déposez un fichier ou{" "}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={pending}
                  className="text-equatis-turquoise-700 font-medium hover:underline"
                >
                  parcourez
                </button>
              </>
            )}
          </p>
          <p className="text-xs text-slate-500">
            PDF, JPG, PNG, DOCX — max 20 Mo
          </p>
          <Button
            variant="outline"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            Choisir un fichier
          </Button>
        </div>
        {error && (
          <Alert variant="danger" role="alert" className="mt-3">
            <span className="flex items-center gap-2">
              <X className="size-4" aria-hidden /> {error}
            </span>
          </Alert>
        )}
      </div>
    </div>
  );
}
