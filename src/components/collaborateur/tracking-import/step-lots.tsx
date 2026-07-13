"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { importTrackingLotsAction } from "@/lib/collaborateur/tracking-import-actions";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import-types";

interface EditableLot {
  building: string | null;
  reference: string;
  floor: number | null;
  type: string;
  surface: number;
  priceHT: number;
  vatRate: number;
  notes: string | null;
}

interface Props {
  rows: ParsedTrackingLot[];
  programmeId: string;
  onNext: (lotIds: Record<string, string>) => void;
  onBack?: () => void;
}

export function StepLots({ rows, programmeId, onNext, onBack }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lots, setLots] = useState<EditableLot[]>(() =>
    rows.map((r) => ({
      building: r.building,
      reference: r.reference,
      floor: r.floor,
      type: r.type,
      surface: r.surface,
      priceHT: r.priceHT,
      vatRate: r.vatRate,
      notes: r.lotNotes,
    })),
  );

  function update<K extends keyof EditableLot>(
    index: number,
    key: K,
    value: EditableLot[K],
  ) {
    setLots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, [key]: value };
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await importTrackingLotsAction({ programmeId, lots });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onNext(result.value.lotIds);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        {lots.length} lot(s) détecté(s). Vérifiez et corrigez avant
        d&apos;importer.
      </p>

      <div className="rounded-md border border-slate-200">
        <Table className="text-xs">
          <THead className="border-b-0 tracking-normal text-slate-600 normal-case">
            <Tr>
              {[
                "Référence",
                "Étage",
                "Type",
                "Surface (m²)",
                "Prix HT (€)",
                "TVA (%)",
              ].map((h) => (
                <Th key={h} className="px-2 py-2 font-medium">
                  {h}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {/* key par index : liste de taille fixe, jamais réordonnée ;
                la référence est éditable (et non garantie unique). */}
            {lots.map((lot, i) => (
              <Tr key={i} className="hover:bg-slate-50">
                <Td className="px-2 py-1">
                  <input
                    className="w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-xs"
                    value={lot.reference}
                    onChange={(e) => update(i, "reference", e.target.value)}
                  />
                </Td>
                <Td className="px-2 py-1">
                  <input
                    type="number"
                    className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.floor ?? ""}
                    onChange={(e) =>
                      update(
                        i,
                        "floor",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </Td>
                <Td className="px-2 py-1">
                  <input
                    className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.type}
                    onChange={(e) => update(i, "type", e.target.value)}
                  />
                </Td>
                <Td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.surface}
                    onChange={(e) =>
                      update(i, "surface", Number(e.target.value))
                    }
                  />
                </Td>
                <Td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.priceHT}
                    onChange={(e) =>
                      update(i, "priceHT", Number(e.target.value))
                    }
                  />
                </Td>
                <Td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.vatRate}
                    onChange={(e) =>
                      update(i, "vatRate", Number(e.target.value))
                    }
                  />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex justify-end gap-2">
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            disabled={pending}
            className="mr-auto"
          >
            ← Retour
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Import en cours…" : `Importer ${lots.length} lots →`}
        </Button>
      </div>
    </div>
  );
}
