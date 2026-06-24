"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseTrackingFileAction } from "@/lib/collaborateur/tracking-import-actions";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import-types";

const ACCEPTED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

interface Props {
  onParsed: (
    fileB64: string,
    rows: ParsedTrackingLot[],
    errors: string[],
  ) => void;
}

export function StepUpload({ onParsed }: Props) {
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const ok = ACCEPTED.includes(f.type) || /\.xlsx?$/i.test(f.name);
    if (!ok) {
      setError("Format non supporté. Déposez un fichier Excel (.xlsx).");
      return;
    }
    setError(null);
    setWarnings([]);
    setFile(f);
  }, []);

  function handleSubmit() {
    if (!file) {
      setError("Sélectionnez un fichier Excel.");
      return;
    }
    startTransition(async () => {
      let b64: string;
      try {
        b64 = await fileToBase64(file);
      } catch {
        setError("Lecture du fichier impossible.");
        return;
      }
      const result = await parseTrackingFileAction(b64);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { rows, errors } = result.value;
      if (rows.length === 0) {
        setError(
          errors.length > 0
            ? errors.join(" ")
            : "Aucune ligne valide extraite.",
        );
        return;
      }
      setWarnings(errors);
      onParsed(b64, rows, errors);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Déposez le tableau de suivi Excel collaborateur.
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition",
          dragging
            ? "border-equatis-turquoise-500 bg-equatis-turquoise-50"
            : "hover:border-equatis-turquoise-400 border-slate-300 hover:bg-slate-50",
        )}
      >
        {file ? (
          <>
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
            <p className="text-equatis-night-800 text-sm font-medium">
              {file.name}
            </p>
            <p className="text-xs text-slate-500">
              Cliquez ou déposez pour remplacer.
            </p>
          </>
        ) : (
          <>
            <FileSpreadsheet
              className="text-equatis-turquoise-600 size-8"
              aria-hidden
            />
            <p className="text-equatis-night-800 text-sm font-medium">
              Glissez-déposez le fichier Excel ici
            </p>
            <p className="text-xs text-slate-500">ou cliquez pour parcourir</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="sr-only"
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {warnings.length > 0 && (
        <Alert variant="warning">
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!file || pending}>
          {pending ? "Analyse en cours…" : "Analyser le fichier →"}
        </Button>
      </div>
    </div>
  );
}
