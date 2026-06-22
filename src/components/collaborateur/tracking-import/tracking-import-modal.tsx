"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import";
import { StepUpload } from "./step-upload";
import { StepProgramme } from "./step-programme";
import { StepLots } from "./step-lots";
import { StepDossiers } from "./step-dossiers";

interface Props {
  open: boolean;
  onClose: () => void;
  programmes: Array<{ id: string; name: string; reference: string }>;
}

const STEP_LABELS = ["Fichier", "Programme", "Lots", "Dossiers"];

export function TrackingImportModal({ open, onClose, programmes }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = React.useState<0 | 1 | 2 | 3>(0);
  const [fileB64, setFileB64] = React.useState<string | null>(null);
  const [parsedRows, setParsedRows] = React.useState<ParsedTrackingLot[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [programmeId, setProgrammeId] = React.useState<string | null>(null);
  const [lotIds, setLotIds] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  function handleClose() {
    if (step > 0) {
      if (!confirm("Fermer l'assistant d'import ? La progression sera perdue."))
        return;
    }
    setStep(0);
    setFileB64(null);
    setParsedRows([]);
    setParseErrors([]);
    setProgrammeId(null);
    setLotIds({});
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      className={cn(
        "fixed inset-0 m-auto h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white p-0 shadow-xl",
        "backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-equatis-night-800 text-lg font-semibold">
            Import tableau de suivi
          </h2>
          <div className="mt-1 flex gap-2">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  i === step
                    ? "bg-equatis-turquoise-100 text-equatis-turquoise-700"
                    : i < step
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                )}
              >
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fermer"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {step === 0 && (
          <StepUpload
            onParsed={(b64, rows, errors) => {
              setFileB64(b64);
              setParsedRows(rows);
              setParseErrors(errors);
              setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <StepProgramme
            programmes={programmes}
            onNext={(id) => {
              setProgrammeId(id);
              setStep(2);
            }}
          />
        )}
        {step === 2 && programmeId && (
          <StepLots
            rows={parsedRows}
            programmeId={programmeId}
            onNext={(ids) => {
              setLotIds(ids);
              setStep(3);
            }}
          />
        )}
        {step === 3 && programmeId && (
          <StepDossiers
            rows={parsedRows}
            programmeId={programmeId}
            lotIds={lotIds}
            onDone={handleClose}
          />
        )}
        {parseErrors.length > 0 && step === 1 && (
          <div className="mt-4 space-y-1">
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-amber-700">
                {e}
              </p>
            ))}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
