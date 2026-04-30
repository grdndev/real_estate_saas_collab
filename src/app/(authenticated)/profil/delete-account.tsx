"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { requestAccountDeletionAction } from "@/lib/client-space/actions";

interface Props {
  alreadyRequested: boolean;
}

export function DeleteAccountSection({ alreadyRequested }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (alreadyRequested) {
    return (
      <Alert variant="warning">
        Une demande de suppression de votre compte est en cours de traitement
        par l&apos;administrateur. Conformément à la RGPD, elle sera traitée
        sous 30 jours.
      </Alert>
    );
  }

  return (
    <>
      <p className="text-sm text-slate-600">
        Conformément à votre droit à l&apos;effacement (RGPD), vous pouvez
        demander la suppression de votre compte. Votre demande sera transmise à
        l&apos;administrateur Équatis et traitée sous 30 jours.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)} className="mt-3">
        Demander la suppression de mon compte
      </Button>
      <ConfirmDialog
        open={open}
        title="Demander la suppression de mon compte ?"
        description="Cette demande sera enregistrée et envoyée à l'administrateur Équatis. Pendant le traitement (jusqu'à 30 jours), votre compte sera suspendu et inaccessible."
        destructive
        confirmLabel="Envoyer ma demande"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            await requestAccountDeletionAction();
            setOpen(false);
            router.refresh();
          })
        }
      />
    </>
  );
}
