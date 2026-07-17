"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepUpload } from "@/components/collaborateur/tracking-import/step-upload";
import { TrackingImportModal } from "@/components/collaborateur/tracking-import/tracking-import-modal";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import-types";

interface Props {
  programmes: Array<{ id: string; name: string; reference: string }>;
}

export function PromoterImportWizard({ programmes }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedTrackingLot[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  // Incrémenté à chaque import pour remonter la modale avec un état neuf.
  const [runKey, setRunKey] = useState(0);

  function handleClose() {
    setOpen(false);
    setRows([]);
    setErrors([]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau programme depuis un tableau de suivi</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          Déposez votre tableau de suivi Excel. Une fois le fichier lu, vous
          renseignez le programme, les lots puis les dossiers, étape par étape.
        </Alert>
        <StepUpload
          onParsed={(_b64, parsedRows, parseErrors) => {
            setRows(parsedRows);
            setErrors(parseErrors);
            setRunKey((k) => k + 1);
            setOpen(true);
          }}
        />
        <TrackingImportModal
          key={runKey}
          open={open}
          onClose={handleClose}
          programmes={programmes}
          initialStep={1}
          initialRows={rows}
          initialErrors={errors}
        />
      </CardContent>
    </Card>
  );
}
