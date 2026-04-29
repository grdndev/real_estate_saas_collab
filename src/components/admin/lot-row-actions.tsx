"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { deleteLotAction } from "@/lib/admin/actions";

export function DeleteLotButton({ lotId }: { lotId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Supprimer
      </Button>
      <ConfirmDialog
        open={open}
        title="Supprimer ce lot ?"
        description={
          error ??
          "Action irréversible. Le lot ne doit pas être rattaché à un dossier."
        }
        destructive
        confirmLabel="Supprimer"
        pending={pending}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteLotAction(lotId);
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
