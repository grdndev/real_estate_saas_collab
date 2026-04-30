import { Check } from "lucide-react";
import type { DossierStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STAGES: Array<{ status: DossierStatus; label: string }> = [
  { status: "NEW_LEAD", label: "Lead reçu" },
  { status: "RESERVATION_SENT", label: "Réservation envoyée" },
  { status: "SIGNATURE_PENDING", label: "Signature en attente" },
  { status: "SIGNED_AT_NOTARY", label: "Chez le notaire" },
  { status: "LOAN_OFFER_RECEIVED", label: "Offre de prêt reçue" },
  { status: "ACT_SIGNED", label: "Acte signé" },
];

export function DossierProgress({ current }: { current: DossierStatus }) {
  const currentIndex = STAGES.findIndex((s) => s.status === current);
  const isBlocked = current === "BLOCKED";

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
      {STAGES.map((stage, idx) => {
        const completed = idx < currentIndex;
        const active = idx === currentIndex;
        return (
          <li key={stage.status} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                completed && "border-emerald-500 bg-emerald-500 text-white",
                active && "border-sky-600 bg-sky-600 text-white",
                !completed &&
                  !active &&
                  "border-slate-300 bg-white text-slate-400",
                isBlocked && active && "border-red-500 bg-red-500",
              )}
            >
              {completed ? <Check className="size-4" aria-hidden /> : idx + 1}
            </div>
            <span
              className={cn(
                "text-xs",
                active && "font-semibold text-sky-800",
                completed && "text-slate-700",
                !completed && !active && "text-slate-400",
              )}
            >
              {stage.label}
            </span>
            {idx < STAGES.length - 1 && (
              <span
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  completed ? "bg-emerald-500" : "bg-slate-200",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function nextStageLabel(current: DossierStatus): string {
  if (current === "ACT_SIGNED") return "Toutes les étapes sont terminées.";
  if (current === "BLOCKED")
    return "Le dossier est bloqué — votre collaborateur référent va vous recontacter.";
  const idx = STAGES.findIndex((s) => s.status === current);
  return STAGES[idx + 1]?.label ?? "Étape suivante en cours d'évaluation.";
}
