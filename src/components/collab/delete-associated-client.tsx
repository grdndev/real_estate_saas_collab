"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteAssociatedClientAction } from "@/lib/client-account/actions";

/**
 * Suppression d'un « client associé » sans compte (T7).
 *
 * Le libellé de confirmation dépend de l'historique : une fiche sans dossier
 * disparaît définitivement, une fiche ayant porté des dossiers archivés est
 * seulement retirée des listes (l'historique reste consultable sur les lots).
 */
interface Props {
  clientId: string;
  clientName: string;
  activeDossiers: number;
  archivedDossiers: number;
  /** Où revenir après une suppression réussie ; sinon simple refresh. */
  redirectTo?: string;
}

export function DeleteAssociatedClientButton({
  clientId,
  clientName,
  activeDossiers,
  archivedDossiers,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const blocked = activeDossiers > 0;

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteAssociatedClientAction(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        aria-label={`Supprimer la fiche de ${clientName}`}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        destructive
        title={`Supprimer la fiche de ${clientName} ?`}
        description={
          blocked ? (
            <>
              Ce client suit encore {activeDossiers} dossier
              {activeDossiers > 1 ? "s" : ""} actif
              {activeDossiers > 1 ? "s" : ""}. Dissociez-le de son lot depuis la
              fiche du lot avant de supprimer sa fiche.
            </>
          ) : archivedDossiers > 0 ? (
            <>
              La fiche sera retirée des listes. Ses {archivedDossiers} dossier
              {archivedDossiers > 1 ? "s" : ""} archivé
              {archivedDossiers > 1 ? "s" : ""} — documents, échanges et
              timeline — restent conservés pour la piste d&apos;audit. Cette
              action est journalisée.
            </>
          ) : (
            <>
              Cette fiche n&apos;a jamais porté de dossier : elle sera supprimée
              définitivement. Cette action est journalisée.
            </>
          )
        }
        confirmLabel="Supprimer"
        pending={pending}
        error={blocked ? "Dissociez d'abord ce client de son lot." : error}
        onCancel={() => setOpen(false)}
        onConfirm={submit}
      />
    </>
  );
}
