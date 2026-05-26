"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  setDossierOptionAction,
  recordOptionReminderAction,
} from "@/lib/dossier/actions";

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
  const [months, setMonths] = useState("3");
  const [error, setError] = useState<string | null>(null);

  const expiry = optionExpiresAt ? new Date(optionExpiresAt) : null;

  function setOption(value: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setDossierOptionAction({
        dossierId,
        optioned: value,
        optionDelayMonths: Number(months),
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
                Délai de l&apos;option
              </span>
              <Select
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              >
                <option value="1">1 mois</option>
                <option value="2">2 mois</option>
                <option value="3">3 mois</option>
                <option value="6">6 mois</option>
              </Select>
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
