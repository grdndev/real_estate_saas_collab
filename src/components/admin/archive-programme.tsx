"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { archiveProgrammeAction } from "@/lib/admin/actions";

export function ArchiveProgrammeButton({
  programmeId,
  basePath,
}: {
  programmeId: string;
  /** Racine « programmes » de l'espace appelant, ex. « /admin/programmes ». */
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Archiver le programme
      </Button>
      <ConfirmDialog
        open={open}
        title="Archiver ce programme ?"
        description="Le programme ne sera plus visible côté collaborateur ni promoteur. Les dossiers existants restent consultables."
        destructive
        confirmLabel="Archiver"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            await archiveProgrammeAction(programmeId);
            setOpen(false);
            router.replace(basePath);
            router.refresh();
          })
        }
      />
    </>
  );
}
