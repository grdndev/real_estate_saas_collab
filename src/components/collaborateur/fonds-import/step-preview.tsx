"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { importFondsSuiviAction } from "@/lib/collaborateur/fonds-import-actions";
import type {
  ParsedFondsLot,
  ParsedFondsAppelType,
} from "@/lib/collaborateur/fonds-import-types";

interface Props {
  rows: ParsedFondsLot[];
  appelTypes: ParsedFondsAppelType[];
  programmeId: string;
  onBack: () => void;
  onDone: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function StepPreview({
  rows,
  appelTypes,
  programmeId,
  onBack,
  onDone,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    matched: number;
    unmatched: string[];
  } | null>(null);
  const [draftRows, setDraftRows] = useState<ParsedFondsLot[]>(() =>
    rows.map((r) => ({
      ...r,
      appelsFonds: r.appelsFonds.map((a) => ({ ...a })),
    })),
  );

  function handleMontantChange(
    lotReference: string,
    at: ParsedFondsAppelType,
    val: number,
  ) {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.lotReference !== lotReference) return r;
        const exists = r.appelsFonds.some((a) => a.numero === at.numero);
        if (exists) {
          return {
            ...r,
            appelsFonds: r.appelsFonds.map((a) =>
              a.numero !== at.numero ? a : { ...a, montant: val },
            ),
          };
        }
        return {
          ...r,
          appelsFonds: [
            ...r.appelsFonds,
            {
              numero: at.numero,
              label: at.label,
              datePrevue: `${at.mois} ${at.annee}`,
              pourcentage: at.pourcentage,
              montant: val,
            },
          ],
        };
      }),
    );
  }

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const serialized = draftRows.map((r) => ({
        ...r,
        dateSignatureActe: r.dateSignatureActe?.toISOString() ?? null,
        dateEnvoiLr: r.dateEnvoiLr?.toISOString() ?? null,
        dateReceptionLr: r.dateReceptionLr?.toISOString() ?? null,
        dateReceptionVirement: r.dateReceptionVirement?.toISOString() ?? null,
      }));

      const res = await importFondsSuiviAction({
        programmeId,
        appelTypes,
        rows: serialized,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.value);
    });
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            {result.matched} lot{result.matched !== 1 ? "s" : ""} importé
            {result.matched !== 1 ? "s" : ""} avec succès.
          </p>
        </div>

        {result.unmatched.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-800">
              {result.unmatched.length} référence
              {result.unmatched.length !== 1 ? "s" : ""} non trouvée
              {result.unmatched.length !== 1 ? "s" : ""} dans le programme :
            </p>
            <ul className="space-y-0.5">
              {result.unmatched.map((ref) => (
                <li key={ref} className="font-mono text-xs text-red-700">
                  {ref}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onDone}>Terminer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        {draftRows.length} lot{draftRows.length !== 1 ? "s" : ""} détecté
        {draftRows.length !== 1 ? "s" : ""}. Vérifiez avant d&apos;importer.
      </p>

      <div className="rounded-lg border border-slate-200">
        <Table style={{ minWidth: `${300 + appelTypes.length * 140}px` }}>
          <THead className="tracking-normal normal-case">
            <Tr>
              <Th className="sticky left-0 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                Lot
              </Th>
              <Th className="px-3 py-2 text-xs font-medium text-slate-500">
                Acquéreur
              </Th>
              {appelTypes.map((at) => (
                <Th
                  key={at.numero}
                  className="min-w-28 px-3 py-2 text-right text-xs font-medium text-slate-500"
                >
                  ({at.numero}) {at.mois} {at.annee} — {at.pourcentage}%
                </Th>
              ))}
              <Th className="px-3 py-2 text-right text-xs font-medium text-slate-500">
                Total
              </Th>
            </Tr>
          </THead>
          <TBody>
            {draftRows.map((row) => {
              const total = row.appelsFonds.reduce((s, a) => s + a.montant, 0);
              return (
                <Tr key={row.lotReference} className="hover:bg-slate-50">
                  <Td className="sticky left-0 bg-white px-3 py-2 font-mono text-xs hover:bg-slate-50">
                    {row.lotReference}
                  </Td>
                  <Td className="px-3 py-2 text-slate-700">
                    {row.nomAcquereur ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  {appelTypes.map((at) => {
                    const montant =
                      row.appelsFonds.find((a) => a.numero === at.numero)
                        ?.montant ?? 0;
                    return (
                      <Td
                        key={at.numero}
                        className="min-w-28 px-3 py-2 text-right tabular-nums"
                      >
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={montant}
                          onChange={(e) =>
                            handleMontantChange(
                              row.lotReference,
                              at,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="focus:border-equatis-turquoise-400 w-24 rounded border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
                        />
                      </Td>
                    );
                  })}
                  <Td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {total > 0 ? (
                      fmt(total)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={pending}
          className="mr-auto"
        >
          ← Retour
        </Button>
        <Button onClick={handleImport} disabled={pending}>
          {pending ? "Import en cours…" : "Importer"}
        </Button>
      </div>
    </div>
  );
}
