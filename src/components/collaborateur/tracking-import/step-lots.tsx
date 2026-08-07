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
  priceTTC: number;
  vatRate: number;
  notes: string | null;
  annexSurface: number | null;
  suv: number | null;
  garden: number | null;
  priceNetVendeur: number | null;
  priceNetVendeurWithParking: number | null;
  commissionAgence: number | null;
  commissionAgenceParking: number | null;
  priceLocation: number | null;
  creditImpot35: number | null;
  priceRevientCrdImp: number | null;
  additionalParking: boolean | null;
  /** Numéro de ligne dans le fichier Excel — repère pour la correction. */
  sourceRow: number;
  /** Champs obligatoires absents du fichier, à compléter ici (T8). */
  incompleteFields: string[];
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
      priceTTC: r.priceTTC,
      vatRate: r.vatRate,
      notes: r.lotNotes,
      sourceRow: r.sourceRow,
      incompleteFields: r.incompleteFields,
      annexSurface: r.annexSurface,
      suv: r.suv,
      garden: r.garden,
      priceNetVendeur: r.priceNetVendeur,
      priceNetVendeurWithParking: r.priceNetVendeurWithParking,
      commissionAgence: r.commissionAgence,
      commissionAgenceParking: r.commissionAgenceParking,
      priceLocation: r.priceLocation,
      creditImpot35: r.creditImpot35,
      priceRevientCrdImp: r.priceRevientCrdImp,
      additionalParking: r.additionalParking,
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

  // Une ligne reste « à compléter » tant que la valeur manquante vaut 0.
  const incomplete = lots.filter(
    (lot) =>
      lot.incompleteFields.length > 0 &&
      ((lot.incompleteFields.includes("surface") && lot.surface <= 0) ||
        (lot.incompleteFields.includes("prix FAI") && lot.priceTTC <= 0)),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        {lots.length} lot(s) détecté(s). Vérifiez et corrigez avant
        d&apos;importer.
      </p>

      {/* Aucune ligne référencée n'est ignorée : celles dont une valeur
          obligatoire manque sont signalées ici pour correction (T8). */}
      {incomplete.length > 0 && (
        <Alert variant="warning" role="status">
          <p className="font-medium">
            {incomplete.length} ligne(s) à compléter — valeur absente du fichier
            (remplacée par 0) :
          </p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {incomplete.map((lot) => (
              <li key={`${lot.sourceRow}-${lot.reference}`}>
                Ligne {lot.sourceRow} — lot{" "}
                <span className="font-mono">{lot.reference}</span> :{" "}
                {lot.incompleteFields.join(", ")}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <Table className="text-xs">
          <THead className="border-b-0 tracking-normal text-slate-600 normal-case">
            <Tr>
              {[
                "Localisation",
                "Référence",
                "Étage",
                "Type",
                "Surface (m²)",
                "Surface annexes (m²)",
                "Surface utile SUV (m²)",
                "Jardin (m²)",
                "Prix HT (€)",
                "TVA (%)",
                "Prix FAI (€)",
                "Prix net vendeur (€)",
                "NV avec parking (€)",
                "Commission agence (€)",
                "CA parking (€)",
                "Prix location (€)",
                "Crédit d'impôt 35% (€)",
                "Prix de revient (€)",
                "Parking suppl.",
              ].map((h) => (
                <Th key={h} className="px-2 py-2 font-medium whitespace-nowrap">
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
                    className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.building ?? ""}
                    onChange={(e) =>
                      update(i, "building", e.target.value || null)
                    }
                  />
                </Td>
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
                <NumberCell
                  value={lot.annexSurface}
                  onChange={(v) => update(i, "annexSurface", v)}
                />
                <NumberCell
                  value={lot.suv}
                  onChange={(v) => update(i, "suv", v)}
                />
                <NumberCell
                  value={lot.garden}
                  onChange={(v) => update(i, "garden", v)}
                />
                {/* Les trois montants sont saisis indépendamment : aucun n'est
                    recalculé à partir des deux autres. Le HT proposé ici est
                    celui déduit du fichier quand la colonne en est absente —
                    il reste corrigeable avant l'import. */}
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
                <Td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={lot.priceTTC}
                    onChange={(e) =>
                      update(i, "priceTTC", Number(e.target.value))
                    }
                  />
                </Td>
                <NumberCell
                  value={lot.priceNetVendeur}
                  onChange={(v) => update(i, "priceNetVendeur", v)}
                />
                <NumberCell
                  value={lot.priceNetVendeurWithParking}
                  onChange={(v) => update(i, "priceNetVendeurWithParking", v)}
                />
                <NumberCell
                  value={lot.commissionAgence}
                  onChange={(v) => update(i, "commissionAgence", v)}
                />
                <NumberCell
                  value={lot.commissionAgenceParking}
                  onChange={(v) => update(i, "commissionAgenceParking", v)}
                />
                <NumberCell
                  value={lot.priceLocation}
                  onChange={(v) => update(i, "priceLocation", v)}
                />
                <NumberCell
                  value={lot.creditImpot35}
                  onChange={(v) => update(i, "creditImpot35", v)}
                />
                <NumberCell
                  value={lot.priceRevientCrdImp}
                  onChange={(v) => update(i, "priceRevientCrdImp", v)}
                />
                <BoolCell
                  value={lot.additionalParking}
                  onChange={(v) => update(i, "additionalParking", v)}
                />
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

function NumberCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Td className="px-2 py-1">
      <input
        type="number"
        step="0.01"
        className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Td>
  );
}

function BoolCell({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <Td className="px-2 py-1 text-center">
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Td>
  );
}
