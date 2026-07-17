"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { unassignClientAction } from "@/lib/dossier/actions";

interface Props {
  dossierId: string;
  clientName: string;
  /** Le dossier provient de la conversion d'un prospect. */
  convertedProspect?: boolean;
  /** Une signature électronique est en cours sur le dossier. */
  pendingSignature?: boolean;
  variant?: "ghost" | "outline";
}

export function UnassignClientButton({
  dossierId,
  clientName,
  convertedProspect = false,
  pendingSignature = false,
  variant = "outline",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        className="text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Dissocier le client
      </Button>
      <ConfirmDialog
        open={open}
        title={`Dissocier ${clientName} ?`}
        description={
          <div className="space-y-2">
            <p>
              Le compte du client est conservé et repasse en attente
              d&apos;association. Le lot reste lié au dossier, ainsi que les
              documents déjà déposés.
            </p>
            {convertedProspect && (
              <p className="font-medium text-amber-700">
                Ce dossier provient de la conversion d&apos;un prospect ; le
                prospect restera marqué comme converti.
              </p>
            )}
            {pendingSignature && (
              <p className="font-medium text-amber-700">
                Une signature électronique est en cours sur ce dossier.
              </p>
            )}
          </div>
        }
        error={error || undefined}
        destructive
        confirmLabel="Dissocier"
        pending={pending}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() =>
          startTransition(async () => {
            const result = await unassignClientAction({ dossierId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            router.refresh();
          })
        }
      />
    </>
  );
}
