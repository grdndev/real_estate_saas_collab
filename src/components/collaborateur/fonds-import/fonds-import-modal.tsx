"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import type {
  ParsedFondsLot,
  ParsedFondsAppelType,
} from "@/lib/collaborateur/fonds-import-types";
import { StepUpload } from "./step-upload";
import { StepProgramme } from "./step-programme";
import { StepAppels } from "./step-appels";
import { StepPreview } from "./step-preview";

interface Props {
  open: boolean;
  onClose: () => void;
  programmes: Array<{ id: string; name: string }>;
}

const STEP_LABELS = ["Fichier", "Programme", "Appels", "Aperçu"];

export function FondsImportModal({ open, onClose, programmes }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = React.useState<0 | 1 | 2 | 3>(0);
  const [parsedRows, setParsedRows] = React.useState<ParsedFondsLot[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [programmeId, setProgrammeId] = React.useState<string | null>(null);
  const [appelTypes, setAppelTypes] = React.useState<ParsedFondsAppelType[]>(
    [],
  );

  React.useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  function handleClose(done?: boolean) {
    if (step > 0 && !done) {
      if (!confirm("Fermer l'assistant d'import ? La progression sera perdue."))
        return;
    }
    setStep(0);
    setParsedRows([]);
    setParseErrors([]);
    setProgrammeId(null);
    setAppelTypes([]);
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
        "fixed inset-0 m-auto h-[90vh] w-fit min-w-1/2 overflow-hidden rounded-xl bg-white p-0 shadow-xl",
        "backdrop:bg-black/40 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-equatis-night-800 text-lg font-semibold">
            Import tableau de suivi des fonds
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
          onClick={() => handleClose()}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fermer"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {parseErrors.length > 0 && step === 1 && (
          <Alert variant="warning" className="mb-4">
            <p className="mb-1 text-sm font-semibold">
              Avertissements de lecture du fichier
            </p>
            <ul className="space-y-0.5 text-xs">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}
        {step === 0 && (
          <StepUpload
            onParsed={(_b64, rows, types, errors) => {
              setParsedRows(rows);
              setAppelTypes(types);
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
            onBack={() => {
              setParsedRows([]);
              setParseErrors([]);
              setStep(0);
            }}
          />
        )}
        {step === 2 && (
          <StepAppels
            appelTypes={appelTypes}
            onNext={(confirmed) => {
              setAppelTypes(confirmed);
              setStep(3);
            }}
            onBack={() => {
              setProgrammeId(null);
              setStep(1);
            }}
          />
        )}
        {step === 3 && programmeId && (
          <StepPreview
            rows={parsedRows}
            appelTypes={appelTypes}
            programmeId={programmeId}
            onBack={() => setStep(2)}
            onDone={() => handleClose(true)}
          />
        )}
      </div>
    </dialog>,
    document.body,
  );
}
