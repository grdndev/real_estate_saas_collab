"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FondsImportModal } from "./fonds-import-modal";

interface Props {
  programmes: Array<{ id: string; name: string }>;
}

export function FondsImportButton({ programmes }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="mr-2 size-4" aria-hidden />
        Importer le suivi des fonds
      </Button>
      <FondsImportModal
        open={open}
        onClose={() => setOpen(false)}
        programmes={programmes}
      />
    </>
  );
}
