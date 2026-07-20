"use client";

import { useState } from "react";
import { Th, THead, Tr } from "@/components/ui/table";
import {
  AppelsFondsModal,
  type AppelHeader,
  type AppelsModalInitialState,
} from "@/components/collaborateur/fonds/appels-fonds-modal";

export type { AppelHeader };

interface Props {
  programmeId: string;
  appelHeaders: AppelHeader[];
}

function fmtMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtPct(p: number): string {
  return p % 1 === 0 ? Math.floor(p).toString() : p.toFixed(1);
}

export function FondsTableHeader({ programmeId, appelHeaders }: Props) {
  const [modalState, setModalState] = useState<AppelsModalInitialState | null>(
    null,
  );

  const debloques = appelHeaders.filter((h) => h.debloque);

  return (
    <>
      <THead>
        <Tr>
          <Th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Lot</Th>
          <Th className="px-4 py-3">Acquéreur</Th>
          <Th className="px-4 py-3 text-right">Prix FAI</Th>
          <Th className="px-4 py-3">Date signature</Th>
          <Th className="px-4 py-3">Progression</Th>

          {debloques.map((h) => (
            <Th
              key={h.numero}
              onClick={() => setModalState({ type: "edit", appel: h })}
              className="cursor-pointer px-4 py-3 text-right select-none hover:bg-slate-100 hover:text-slate-800"
              title={`${h.label} — ${fmtMonth(h.datePrevue)} (cliquer pour modifier)`}
            >
              {h.label} ({fmtPct(h.pourcentage)}%)
            </Th>
          ))}

          {appelHeaders.length === 0 && (
            <Th className="px-4 py-3 text-center text-slate-400">
              Aucun appel de fonds
            </Th>
          )}

          <Th className="px-4 py-3 text-right">COM</Th>
          <Th className="px-4 py-3 text-right">Frais</Th>
          <Th className="px-4 py-3 text-right">RBST EDD</Th>
          <Th className="px-4 py-3 text-right">Solde vendeur</Th>
          <Th className="px-4 py-3">Commentaire</Th>
        </Tr>
      </THead>

      {modalState != null && (
        <AppelsFondsModal
          programmeId={programmeId}
          appelHeaders={appelHeaders}
          initialState={modalState}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  );
}
