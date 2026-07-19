"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { updateLotFondsSuiviAction } from "@/lib/collaborateur/fonds-actions";

/** Fonds appelés pour le lot au titre d'un appel de fonds du programme. */
export interface FondsAppeleData {
  appelFondsId: string;
  montant: number;
  dateEnvoiLr: string | null;
  dateReceptionVirement: string | null;
}

export interface FondsSuiviData {
  commission: number | null;
  fraisMainLevee: number | null;
  rbstEdd: number | null;
  soldeVendeur: number | null;
  fondsAppeles: FondsAppeleData[];
}

interface ProgrammeAppelType {
  id: string;
  numero: number;
  label: string;
  pourcentage: number;
  datePrevue: string;
  debloque: boolean;
}

interface Props {
  lotId: string;
  programmeName: string;
  clientName: string | null;
  priceTTC: number;
  actSignedDate: string | null;
  notes: string | null;
  /** Le lot a un dossier avec client (requis pour le courrier PDF). */
  hasClient: boolean;
  /** Le client a une adresse postale renseignée (requis pour le courrier PDF). */
  hasClientAddress: boolean;
  fondsSuivi: FondsSuiviData | null;
  programmeAppelTypes: ProgrammeAppelType[];
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fmtMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
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

type FieldKey = (typeof FINANCIAL_FIELDS)[number]["key"] | "notes";

export function LotFondsForm({
  lotId,
  programmeName,
  clientName,
  priceTTC,
  actSignedDate,
  notes: initialNotes,
  hasClient,
  hasClientAddress,
  fondsSuivi,
  programmeAppelTypes,
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
    notes: initialNotes ?? "",
  });

  // Une ligne par appel de fonds du programme, montant/suivi LR du lot en face.
  const [appels, setAppels] = useState<FondsAppeleData[]>(() => {
    const existingById = new Map(
      (fondsSuivi?.fondsAppeles ?? []).map((fa) => [fa.appelFondsId, fa]),
    );
    return programmeAppelTypes.map((type) => {
      const existing = existingById.get(type.id);
      return {
        appelFondsId: type.id,
        montant: existing?.montant ?? 0,
        dateEnvoiLr: existing?.dateEnvoiLr ?? null,
        dateReceptionVirement: existing?.dateReceptionVirement ?? null,
      };
    });
  });

  const appelsById = new Map(appels.map((a) => [a.appelFondsId, a]));

  // Courrier PDF : nécessite un client avec adresse postale.
  const courrierBloque = !hasClient
    ? "Aucun client rattaché à ce lot."
    : !hasClientAddress
      ? "Le client n'a pas d'adresse postale renseignée."
      : null;

  /** Ouvre le courrier d'appel de fonds dans un nouvel onglet. */
  function ouvrirCourrierPdf(numero: number) {
    window.open(
      `/collaborateur/fonds/${lotId}/appel-pdf?numero=${numero}`,
      "_blank",
      "noopener",
    );
  }
  const nbDebloques = programmeAppelTypes.filter((t) => t.debloque).length;

  function setField(key: FieldKey, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function setAppelMontant(appelFondsId: string, val: string) {
    setAppels((prev) =>
      prev.map((a) =>
        a.appelFondsId === appelFondsId
          ? { ...a, montant: parseFloat(val) || 0 }
          : a,
      ),
    );
    setSaved(false);
  }

  function setAppelDate(
    appelFondsId: string,
    key: "dateEnvoiLr" | "dateReceptionVirement",
    val: string,
  ) {
    setAppels((prev) =>
      prev.map((a) =>
        a.appelFondsId === appelFondsId ? { ...a, [key]: val || null } : a,
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
        notes: fields.notes || null,
        fondsAppeles: appels.map((a) => ({
          appelFondsId: a.appelFondsId,
          montant: a.montant,
          dateEnvoiLr: toDateInput(a.dateEnvoiLr) || null,
          dateReceptionVirement: toDateInput(a.dateReceptionVirement) || null,
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
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-5">
        <div>
          <p className="text-xs text-slate-400">Programme</p>
          <p className="text-sm font-medium">{programmeName}</p>
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
          <p className="text-sm font-medium" suppressHydrationWarning>
            {actSignedDate
              ? new Date(actSignedDate).toLocaleDateString("fr-FR")
              : "—"}
          </p>
        </div>
        {programmeAppelTypes.length > 0 && (
          <div>
            <p className="text-xs text-slate-400">Avancement</p>
            <p className="text-sm font-medium">
              {nbDebloques}/{programmeAppelTypes.length} appel
              {nbDebloques > 1 ? "s" : ""} demandé
              {nbDebloques > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Appels de fonds */}
      {appels.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Appels de fonds
          </h2>
          <div className="rounded-lg border border-slate-200">
            <Table>
              <THead className="tracking-normal text-slate-500 normal-case">
                <Tr>
                  <Th className="px-3 py-2 font-medium">Appel</Th>
                  <Th className="px-3 py-2 text-right font-medium">%</Th>
                  <Th className="px-3 py-2 text-right font-medium">
                    Montant (€)
                  </Th>
                  <Th className="px-3 py-2 font-medium">Date envoi LR</Th>
                  <Th className="px-3 py-2 font-medium">
                    Date réception virement
                  </Th>
                  <Th className="px-3 py-2" />
                </Tr>
              </THead>
              <TBody>
                {programmeAppelTypes.map((type) => {
                  const a = appelsById.get(type.id);
                  if (!a) return null;
                  const debloque = type.debloque;
                  return (
                    <Tr
                      key={type.id}
                      className={debloque ? undefined : "bg-slate-50/60"}
                    >
                      <Td className="px-3 py-2 text-slate-700">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={debloque ? undefined : "text-slate-400"}
                          >
                            {type.label}
                          </span>
                          {!debloque && (
                            <Badge variant="neutral" suppressHydrationWarning>
                              À venir · {fmtMonth(type.datePrevue)}
                            </Badge>
                          )}
                        </span>
                      </Td>
                      <Td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                        {type.pourcentage}%
                      </Td>
                      <Td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={a.montant}
                          onChange={(e) =>
                            setAppelMontant(type.id, e.target.value)
                          }
                          className="focus:border-equatis-turquoise-400 w-36 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
                        />
                      </Td>
                      <Td className="px-3 py-2">
                        <input
                          type="date"
                          value={toDateInput(a.dateEnvoiLr)}
                          onChange={(e) =>
                            setAppelDate(type.id, "dateEnvoiLr", e.target.value)
                          }
                          className="focus:border-equatis-turquoise-400 rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none"
                        />
                      </Td>
                      <Td className="px-3 py-2">
                        <input
                          type="date"
                          value={toDateInput(a.dateReceptionVirement)}
                          onChange={(e) =>
                            setAppelDate(
                              type.id,
                              "dateReceptionVirement",
                              e.target.value,
                            )
                          }
                          className="focus:border-equatis-turquoise-400 rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none"
                        />
                      </Td>
                      <Td className="px-3 py-2 text-right">
                        {/* Courrier PDF uniquement pour les appels débloqués. */}
                        {debloque && (
                          <span
                            title={
                              courrierBloque ??
                              "Générer le courrier d'appel de fonds"
                            }
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={Boolean(courrierBloque)}
                              onClick={() => ouvrirCourrierPdf(type.numero)}
                            >
                              Courrier PDF
                            </Button>
                          </span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
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
