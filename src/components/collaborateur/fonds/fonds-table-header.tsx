"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
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
  /** Sens du tri naturel sur la référence de lot (T13). */
  sortDirection: "asc" | "desc";
  /** Programme sélectionné, à préserver dans le lien de tri. */
  programmeParam: string | null;
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

export function FondsTableHeader({
  programmeId,
  appelHeaders,
  sortDirection,
  programmeParam,
}: Props) {
  const [modalState, setModalState] = useState<AppelsModalInitialState | null>(
    null,
  );

  const debloques = appelHeaders.filter((h) => h.debloque);

  return (
    <>
      <THead>
        <Tr>
          {/* Tri naturel sur la référence de lot, inversable au clic (T13). */}
          <Th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">
            <Link
              href={`?${new URLSearchParams({
                ...(programmeParam ? { programme: programmeParam } : {}),
                tri: sortDirection === "asc" ? "desc" : "asc",
              }).toString()}`}
              aria-label={`Trier par référence de lot, ordre ${
                sortDirection === "asc" ? "décroissant" : "croissant"
              }`}
              className="hover:text-equatis-turquoise-700 inline-flex items-center gap-1"
            >
              Lot
              {sortDirection === "asc" ? (
                <ArrowUp className="size-3.5" aria-hidden />
              ) : (
                <ArrowDown className="size-3.5" aria-hidden />
              )}
            </Link>
          </Th>
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
