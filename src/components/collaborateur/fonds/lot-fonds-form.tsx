"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { updateLotFondsSuiviAction } from "@/lib/collaborateur/fonds-actions";

export interface AppelFondsData {
  id: string;
  numero: number;
  label: string;
  datePrevue: string | null;
  pourcentage: number;
  montant: number;
}

export interface FondsSuiviData {
  commission: number | null;
  fraisMainLevee: number | null;
  rbstEdd: number | null;
  soldeVendeur: number | null;
  dateEnvoiLr: string | null;
  dateReceptionLr: string | null;
  dateReceptionVirement: string | null;
  appelsFonds: AppelFondsData[];
}

interface Props {
  lotId: string;
  programmeName: string;
  programmeReference: string;
  clientName: string | null;
  priceTTC: number;
  actSignedDate: string | null;
  notes: string | null;
  fondsSuivi: FondsSuiviData | null;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ".").replace(/\s/g, ""));
  return isFinite(n) ? n : null;
}

const FINANCIAL_FIELDS = [
  { key: "commission", label: "Commission" },
  { key: "fraisMainLevee", label: "Frais main levée" },
  { key: "rbstEdd", label: "RBST EDD" },
  { key: "soldeVendeur", label: "Solde vendeur" },
] as const;

const DATE_FIELDS = [
  { key: "dateEnvoiLr", label: "Date envoi LR" },
  { key: "dateReceptionLr", label: "Date réception LR" },
  { key: "dateReceptionVirement", label: "Date réception virement" },
] as const;

type FieldKey =
  | (typeof FINANCIAL_FIELDS)[number]["key"]
  | (typeof DATE_FIELDS)[number]["key"]
  | "notes";

export function LotFondsForm({
  lotId,
  programmeName,
  programmeReference,
  clientName,
  priceTTC,
  actSignedDate,
  notes: initialNotes,
  fondsSuivi,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [fields, setFields] = useState<Record<FieldKey, string>>({
    commission: fondsSuivi?.commission?.toString() ?? "",
    fraisMainLevee: fondsSuivi?.fraisMainLevee?.toString() ?? "",
    rbstEdd: fondsSuivi?.rbstEdd?.toString() ?? "",
    soldeVendeur: fondsSuivi?.soldeVendeur?.toString() ?? "",
    dateEnvoiLr: toDateInput(fondsSuivi?.dateEnvoiLr),
    dateReceptionLr: toDateInput(fondsSuivi?.dateReceptionLr),
    dateReceptionVirement: toDateInput(fondsSuivi?.dateReceptionVirement),
    notes: initialNotes ?? "",
  });

  const [appels, setAppels] = useState<AppelFondsData[]>(
    fondsSuivi?.appelsFonds ?? [],
  );

  function setField(key: FieldKey, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function setAppelMontant(id: string, val: string) {
    setAppels((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, montant: parseFloat(val) || 0 } : a,
      ),
    );
    setSaved(false);
  }

  function handleSubmit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateLotFondsSuiviAction({
        lotId,
        commission: parseNum(fields.commission),
        fraisMainLevee: parseNum(fields.fraisMainLevee),
        rbstEdd: parseNum(fields.rbstEdd),
        soldeVendeur: parseNum(fields.soldeVendeur),
        dateEnvoiLr: fields.dateEnvoiLr || null,
        dateReceptionLr: fields.dateReceptionLr || null,
        dateReceptionVirement: fields.dateReceptionVirement || null,
        notes: fields.notes || null,
        appels: appels.map((a) => ({
          id: a.id,
          montant: a.montant,
          datePrevue: a.datePrevue,
        })),
      });

      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Read-only summary */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-400">Programme</p>
          <p className="text-sm font-medium">{programmeName}</p>
          <p className="text-xs text-slate-500">{programmeReference}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Acquéreur</p>
          <p className="text-sm font-medium">{clientName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Prix FAI</p>
          <p className="text-sm font-medium tabular-nums">
            {priceTTC.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Date signature acte</p>
          <p className="text-sm font-medium">
            {actSignedDate
              ? new Date(actSignedDate).toLocaleDateString("fr-FR")
              : "—"}
          </p>
        </div>
      </div>

      {/* Appels de fonds */}
      {appels.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Appels de fonds
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="px-3 py-2 text-left">Appel</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Montant (€)</th>
                </tr>
              </thead>
              <tbody>
                {appels.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-2 text-slate-700">{a.label}</td>
                    <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                      {a.pourcentage}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={a.montant}
                        onChange={(e) => setAppelMontant(a.id, e.target.value)}
                        className="focus:border-equatis-turquoise-400 w-36 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Données financières */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Données financières
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {FINANCIAL_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-slate-500">
                {label}
              </label>
              <input
                type="number"
                step={0.01}
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-2 py-1.5 text-sm tabular-nums focus:outline-none"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Suivi LR */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Suivi LR</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DATE_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-slate-500">
                {label}
              </label>
              <input
                type="date"
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Commentaire */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Commentaire
        </h2>
        <textarea
          rows={3}
          value={fields.notes}
          onChange={(e) => setField("notes", e.target.value)}
          className="focus:border-equatis-turquoise-400 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none"
        />
      </section>

      {error && <Alert variant="danger">{error}</Alert>}
      {saved && <Alert variant="success">Modifications enregistrées.</Alert>}

      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          ← Retour
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
