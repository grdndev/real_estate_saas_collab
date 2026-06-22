"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackingImportModal } from "./tracking-import-modal";

interface Props {
  programmes: Array<{ id: string; name: string; reference: string }>;
}

export function TrackingImportButton({ programmes }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="mr-2 size-4" aria-hidden />
        Import : Tableau de suivi
      </Button>
      <TrackingImportModal
        open={open}
        onClose={() => setOpen(false)}
        programmes={programmes}
      />
    </>
  );
}
