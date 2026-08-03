"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { attachNotaryAction } from "@/lib/notary/actions";

/**
 * Rattachement d'un notaire à un dossier (T4).
 *
 * Simple désignation : aucun document n'est transmis et le statut commercial du
 * dossier n'est pas modifié — c'est ce qui distingue cette action de la
 * transmission au notaire. Le notaire rattaché voit le dossier dans son espace.
 */
interface NotaryOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  dossierId: string;
  notaries: NotaryOption[];
  currentNotaryId: string | null;
  /** Libellé du bouton principal, adapté au contexte (dossier ou lot). */
  label?: string;
}

export function AttachNotaryForm({
  dossierId,
  notaries,
  currentNotaryId,
  label = "Attacher un notaire",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notaryId, setNotaryId] = useState(currentNotaryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = notaries.find((n) => n.id === currentNotaryId) ?? null;

  function run(nextNotaryId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await attachNotaryAction({
        dossierId,
        notaryId: nextNotaryId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (notaries.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Aucun notaire actif. Invitez un notaire depuis l&apos;espace
        d&apos;administration.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {current && (
        <p className="text-sm">
          <span className="text-equatis-night-800 font-medium">
            {current.firstName} {current.lastName}
          </span>
          <span className="block text-xs text-slate-500">{current.email}</span>
        </p>
      )}

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {open ? (
        <div className="space-y-2">
          <label
            htmlFor={`attach-notary-${dossierId}`}
            className="text-equatis-night-800 block text-xs font-medium"
          >
            Notaire à rattacher
          </label>
          <Select
            id={`attach-notary-${dossierId}`}
            value={notaryId}
            onChange={(e) => setNotaryId(e.target.value)}
          >
            <option value="">Sélectionner un notaire…</option>
            {notaries.map((n) => (
              <option key={n.id} value={n.id}>
                {n.firstName} {n.lastName} — {n.email}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            Aucun document ne sera transmis et le statut du dossier reste
            inchangé.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => run(notaryId || null)}
              disabled={pending || !notaryId || notaryId === currentNotaryId}
            >
              {pending ? "Enregistrement…" : "Rattacher"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {current ? "Changer de notaire" : label}
          </Button>
          {current && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => run(null)}
              disabled={pending}
              className="text-red-700 hover:bg-red-50"
            >
              Détacher
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
