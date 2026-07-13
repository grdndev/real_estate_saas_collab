"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { ParsedFondsAppelType } from "@/lib/collaborateur/fonds-import-types";

interface Props {
  appelTypes: ParsedFondsAppelType[];
  onNext: (confirmed: ParsedFondsAppelType[]) => void;
  onBack: () => void;
}

export function StepAppels({ appelTypes, onNext, onBack }: Props) {
  const [draft, setDraft] = React.useState<ParsedFondsAppelType[]>(() =>
    appelTypes.map((a) => ({ ...a })),
  );

  function update(
    index: number,
    field: keyof ParsedFondsAppelType,
    value: string | number,
  ) {
    setDraft((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-slate-800">
          Vérifiez les appels de fonds détectés dans le fichier.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Corrigez le mois, l&apos;année ou le pourcentage si nécessaire avant
          de continuer.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200">
        <Table>
          <THead className="tracking-normal normal-case">
            <Tr>
              <Th className="w-10 px-3 py-2 text-xs font-medium text-slate-500">
                N°
              </Th>
              <Th className="px-3 py-2 text-xs font-medium text-slate-500">
                Label
              </Th>
              <Th className="px-3 py-2 text-xs font-medium text-slate-500">
                Mois
              </Th>
              <Th className="px-3 py-2 text-xs font-medium text-slate-500">
                Année
              </Th>
              <Th className="px-3 py-2 text-right text-xs font-medium text-slate-500">
                %
              </Th>
            </Tr>
          </THead>
          <TBody>
            {draft.map((a, i) => (
              <Tr key={a.numero}>
                <Td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {a.numero}
                </Td>
                <Td className="max-w-[200px] px-3 py-2 text-xs text-slate-700">
                  <span title={a.label}>
                    {a.label.length > 60 ? a.label.slice(0, 60) + "…" : a.label}
                  </span>
                </Td>
                <Td className="px-3 py-2">
                  <input
                    type="text"
                    value={a.mois}
                    onChange={(e) => update(i, "mois", e.target.value)}
                    className="focus:border-equatis-turquoise-500 w-32 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
                  />
                </Td>
                <Td className="px-3 py-2">
                  <input
                    type="number"
                    value={a.annee}
                    onChange={(e) => update(i, "annee", Number(e.target.value))}
                    className="focus:border-equatis-turquoise-500 w-20 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
                  />
                </Td>
                <Td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={a.pourcentage}
                    onChange={(e) =>
                      update(i, "pourcentage", Number(e.target.value))
                    }
                    className="focus:border-equatis-turquoise-500 w-16 rounded border border-slate-300 px-2 py-1 text-right text-xs focus:outline-none"
                  />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="mr-auto">
          ← Retour
        </Button>
        <Button onClick={() => onNext(draft)}>Suivant →</Button>
      </div>
    </div>
  );
}
