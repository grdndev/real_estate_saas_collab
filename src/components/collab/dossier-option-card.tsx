"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setDossierOptionAction,
  recordOptionReminderAction,
} from "@/lib/dossier/actions";

const MIN_DAYS = 7;
const MAX_DAYS = 365;

interface Props {
  dossierId: string;
  optioned: boolean;
  optionExpiresAt: string | null;
  expired: boolean;
}

export function DossierOptionCard({
  dossierId,
  optioned,
  optionExpiresAt,
  expired,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState("12");
  const [error, setError] = useState<string | null>(null);

  const expiry = optionExpiresAt ? new Date(optionExpiresAt) : null;

  // Le délai n'est lu par l'action que lorsqu'on pose l'option : on ne le
  // valide donc qu'à la pose, pas à la levée. Bornes alignées sur
  // `setDossierOptionSchema`.
  function validateDays(): string | null {
    const value = Number(days);
    if (!days.trim() || !Number.isInteger(value)) {
      return "Le délai doit être un nombre entier de jours.";
    }
    if (value < MIN_DAYS || value > MAX_DAYS) {
      return `Le délai doit être compris entre ${MIN_DAYS} et ${MAX_DAYS} jours.`;
    }
    return null;
  }

  function setOption(value: boolean) {
    setError(null);
    if (value) {
      const invalid = validateDays();
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    startTransition(async () => {
      const result = await setDossierOptionAction({
        dossierId,
        optioned: value,
        optionDelayDays: Number(days),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function relance() {
    setError(null);
    startTransition(async () => {
      const result = await recordOptionReminderAction(dossierId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {optioned ? (
        <>
          <div
            className={
              expired
                ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm"
                : "rounded-md border border-violet-200 bg-violet-50 p-3 text-sm"
            }
          >
            <p className="font-medium">
              {expired
                ? "Option expirée"
                : "Dossier optionné — client en attente"}
            </p>
            {expiry && (
              <p className="mt-0.5 text-xs">
                Échéance : {expiry.toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={relance}
              disabled={pending}
            >
              Relancer l&apos;option
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOption(false)}
              disabled={pending}
            >
              Lever l&apos;option
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Marquer ce dossier comme optionné : le client est capable
            d&apos;acheter mais avec un délai.
          </p>
          <div className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">
                Délai de l&apos;option (jours)
              </span>
              <Input
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                step={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                aria-invalid={error !== null}
                className="w-28"
              />
            </label>
            <Button
              type="button"
              size="sm"
              onClick={() => setOption(true)}
              disabled={pending}
            >
              Optionner le dossier
            </Button>
          </div>
        </>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
    </div>
  );
}
