"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AppelsFondsModal,
  type AppelHeader,
} from "@/components/collaborateur/fonds/appels-fonds-modal";

interface Props {
  programmeId: string;
  appelHeaders: AppelHeader[];
}

export function GererAppelsButton({ programmeId, appelHeaders }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title="Gérer les appels de fonds (y compris à venir)"
      >
        Gérer les appels de fonds
      </Button>
      {open && (
        <AppelsFondsModal
          programmeId={programmeId}
          appelHeaders={appelHeaders}
          initialState={{ type: "list" }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
