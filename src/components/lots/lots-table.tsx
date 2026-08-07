"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Une ligne = un LOT. Les champs « client » et le suivi commercial viennent du
 * dossier ACTIF du lot ; ils sont nuls quand le lot n'a pas de client associé.
 */
export interface LotRow {
  /** Identifiant du LOT — c'est lui qui sert de paramètre d'URL. */
  id: string;
  /** Dossier actif du lot, `null` si le lot est libre. */
  dossierId: string | null;
  /** Client associé sans accès à la plateforme (T7). */
  clientHasNoAccount: boolean;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  programmeName: string;
  /** Statut du dossier actif, ou statut du lot quand il est libre. */
  statusLabel: string;
  statusVariant: BadgeVariant;
  /** Statut du lot lui-même (disponible, réservé, vendu…). */
  lotStatusLabel: string;
  responsable: string | null;
  lastActivity: string;

  building: string | null;
  reference: string;
  floor: number | null;
  type: string;
  surface: number;
  annexSurface: number | null;
  totalSurface: number;
  garden: number | null;
  priceNetVendeur: number | null;
  priceNetVendeurWithParking: number | null;
  commissionAgence: number | null;
  commissionAgenceParking: number | null;
  priceFAI: number;
  priceLocation: number | null;
  creditImpot35: number | null;
  priceRevientCrdImp: number | null;
  additionalParking: boolean | null;

  observation: string | null;
  financingMode: string | null;
  optionLabel: string;
  kbisObtainedAt: string | null;
  clientAtRsm: boolean | null;
  reservationSignedAt: string | null;
  notaryTransmittedAt: string | null;
  deposit200ReceivedAt: string | null;
  guaranteeDepositAmount: number | null;
  guaranteeDepositReceivedAt: string | null;
  rarSentByNotaryAt: string | null;
  loanFiledAt: string | null;
  loanObtainedAt: string | null;
  reservationEndDate: string | null;
  actSignedAt: string | null;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function bool(v: boolean | null): string {
  return v == null ? "—" : v ? "Oui" : "Non";
}

function money(v: number | null): string {
  return v == null ? "—" : eur.format(v);
}

interface ColumnDef {
  key: string;
  label: string;
  render: (row: LotRow) => React.ReactNode;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "client",
    label: "Client",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        {r.clientName ?? "—"}
        {r.clientHasNoAccount && <Badge variant="neutral">Sans compte</Badge>}
      </span>
    ),
  },
  { key: "programme", label: "Programme", render: (r) => r.programmeName },
  { key: "lot", label: "Lot", render: (r) => r.reference },
  {
    key: "statut",
    label: "Statut",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant={r.statusVariant}>{r.statusLabel}</Badge>
      </span>
    ),
  },
  { key: "statutLot", label: "Statut du lot", render: (r) => r.lotStatusLabel },
  {
    key: "responsable",
    label: "Responsable",
    render: (r) => r.responsable ?? "—",
  },
  {
    key: "derniereAction",
    label: "Dernière action",
    render: (r) => r.lastActivity,
  },

  {
    key: "localisation",
    label: "Localisation",
    render: (r) => r.building ?? "—",
  },
  {
    key: "etage",
    label: "Étage",
    render: (r) => (r.floor != null ? String(r.floor) : "—"),
  },
  { key: "type", label: "Type", render: (r) => r.type },
  {
    key: "surfaceHabitable",
    label: "Surface Habitable",
    render: (r) => `${r.surface} m²`,
  },
  {
    key: "surfaceAnnexes",
    label: "Surface des annexes",
    render: (r) => (r.annexSurface != null ? `${r.annexSurface} m²` : "—"),
  },
  {
    key: "totalSurface",
    label: "Total (Habitable+annexe)",
    render: (r) => `${r.totalSurface} m²`,
  },
  {
    key: "jardin",
    label: "Jardin",
    render: (r) => (r.garden != null ? `${r.garden} m²` : "—"),
  },
  {
    key: "prixNetVendeur",
    label: "Prix net vendeur",
    render: (r) => money(r.priceNetVendeur),
  },
  {
    key: "nvAvecParking",
    label: "NV avec place parking",
    render: (r) => money(r.priceNetVendeurWithParking),
  },
  {
    key: "commissionAgence",
    label: "Commission agence",
    render: (r) => money(r.commissionAgence),
  },
  {
    key: "caParking",
    label: "CA pour place parking",
    render: (r) => money(r.commissionAgenceParking),
  },
  { key: "prixFai", label: "Prix FAI", render: (r) => money(r.priceFAI) },
  {
    key: "prixLocation",
    label: "Prix à la location",
    render: (r) => money(r.priceLocation),
  },
  {
    key: "creditImpot",
    label: "Montant crédit d'impôt 35%",
    render: (r) => money(r.creditImpot35),
  },
  {
    key: "prixRevient",
    label: "Prix de revient (avec CRD imp.)",
    render: (r) => money(r.priceRevientCrdImp),
  },

  { key: "nom", label: "Nom", render: (r) => r.clientName ?? "—" },
  { key: "tel", label: "Tel", render: (r) => r.clientPhone ?? "—" },
  { key: "mail", label: "Mail", render: (r) => r.clientEmail ?? "—" },
  {
    key: "observation",
    label: "Observation",
    render: (r) => r.observation ?? "—",
  },
  {
    key: "financement",
    label: "Mode de financement",
    render: (r) => r.financingMode ?? "—",
  },
  { key: "option", label: "Option", render: (r) => r.optionLabel },
  {
    key: "kbis",
    label: "Obtention Kbis",
    render: (r) => r.kbisObtainedAt ?? "—",
  },
  { key: "rsm", label: "Client chez RSM", render: (r) => bool(r.clientAtRsm) },
  {
    key: "parkingSupp",
    label: "Parking supplémentaire",
    render: (r) => bool(r.additionalParking),
  },
  {
    key: "signatureResa",
    label: "Signature contrat de résa",
    render: (r) => r.reservationSignedAt ?? "—",
  },
  {
    key: "envoiNotaire",
    label: "Envoi contrat de résa chez le notaire",
    render: (r) => r.notaryTransmittedAt ?? "—",
  },
  {
    key: "reception200",
    label: "Réception des 200€",
    render: (r) => r.deposit200ReceivedAt ?? "—",
  },
  {
    key: "depotGarantie",
    label: "Dépôt de garantie",
    render: (r) => money(r.guaranteeDepositAmount),
  },
  {
    key: "receptionGarantie",
    label: "Réception du dépôt de garantie",
    render: (r) => r.guaranteeDepositReceivedAt ?? "—",
  },
  {
    key: "envoiRar",
    label: "Envoi RAR par le notaire",
    render: (r) => r.rarSentByNotaryAt ?? "—",
  },
  {
    key: "depotPret",
    label: "Dépôt de prêt",
    render: (r) => r.loanFiledAt ?? "—",
  },
  {
    key: "obtentionPret",
    label: "Obtention de prêt",
    render: (r) => r.loanObtainedAt ?? "—",
  },
  {
    key: "finResa",
    label: "Date de fin de contrat de résa",
    render: (r) => r.reservationEndDate ?? "—",
  },
  { key: "acte", label: "Acte", render: (r) => r.actSignedAt ?? "—" },
];

const STORAGE_KEY = "collaborateur.lots.visibleColumns";

const DEFAULT_VISIBLE = new Set([
  "lot",
  "programme",
  "type",
  "statut",
  "client",
  "responsable",
  "derniereAction",
]);

let cachedVisible: Set<string> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): Set<string> {
  if (cachedVisible) return cachedVisible;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cachedVisible = raw
      ? new Set(JSON.parse(raw) as string[])
      : DEFAULT_VISIBLE;
  } catch {
    cachedVisible = DEFAULT_VISIBLE;
  }
  return cachedVisible;
}

function getServerSnapshot(): Set<string> {
  return DEFAULT_VISIBLE;
}

function setVisible(next: Set<string>) {
  cachedVisible = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  listeners.forEach((l) => l());
}

export function LotsTable({
  rows,
  basePath,
}: {
  rows: LotRow[];
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}) {
  const visible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  function toggle(key: string) {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(next);
  }

  const activeColumns = COLUMNS.filter((c) => visible.has(c.key));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Colonnes ({activeColumns.length}/{COLUMNS.length})
        </button>
        {pickerOpen && (
          <div className="absolute top-full right-0 z-20 mt-1 max-h-96 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-2 flex justify-between text-xs text-slate-500">
              <button
                type="button"
                className="hover:underline"
                onClick={() => setVisible(new Set(COLUMNS.map((c) => c.key)))}
              >
                Tout afficher
              </button>
              <button
                type="button"
                className="hover:underline"
                onClick={() => setVisible(new Set(DEFAULT_VISIBLE))}
              >
                Réinitialiser
              </button>
            </div>
            <ul className="space-y-1">
              {COLUMNS.map((c) => (
                <li key={c.key}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visible.has(c.key)}
                      onChange={() => toggle(c.key)}
                    />
                    {c.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun lot ne correspond"
          description="Modifiez vos filtres ou créez un nouveau lot."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                {activeColumns.map((c) => (
                  <Th key={c.key} className="whitespace-nowrap">
                    {c.label}
                  </Th>
                ))}
                <Th />
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  {activeColumns.map((c) => (
                    <Td key={c.key} className="whitespace-nowrap">
                      {c.render(row)}
                    </Td>
                  ))}
                  <Td className="text-right">
                    <Link
                      href={`${basePath}/${row.id}`}
                      className="text-equatis-turquoise-700 text-sm hover:underline"
                    >
                      Ouvrir →
                    </Link>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
