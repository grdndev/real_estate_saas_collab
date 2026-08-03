import { CreateLotForm } from "@/components/admin/lot-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { LotReferenceHeader } from "@/components/views/lots/lot-reference-header";
import { LOT_STATUS_BADGE } from "@/lib/lot/labels";
import { sortByLotReference, type LotSortDirection } from "@/lib/lot/sort";
import type { Prisma } from "@/generated/prisma/client";
import type { LotStatus } from "@/generated/prisma/enums";

/**
 * Vue « grille des lots d'un programme » — implémentation unique partagée par
 * l'espace promoteur et l'espace admin (T3/T15). Aucune donnée nominative.
 */
export interface ProgrammeLotRow {
  id: string;
  reference: string;
  surface: Prisma.Decimal;
  annexSurface: Prisma.Decimal | null;
  suv: Prisma.Decimal | null;
  floor: number | null;
  type: string;
  priceHT: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  priceTTC: Prisma.Decimal;
  status: LotStatus;
}

interface Props {
  programme: { id: string; name: string };
  lots: ProgrammeLotRow[];
  /** Préfixe de l'espace appelant, ex. « /admin/suivi » ou « /promoteur ». */
  basePath: string;
  /** Affiche le formulaire d'ajout de lot. */
  canCreateLot: boolean;
  /** Sens du tri naturel sur la référence de lot (T13). */
  sortDirection: LotSortDirection;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Surface facultative, en m². */
function surfaceLabel(value: Prisma.Decimal | null): string {
  return value == null ? "—" : `${value.toString()} m²`;
}

export function ProgrammeLotsView({
  programme,
  lots,
  basePath,
  canCreateLot,
  sortDirection,
}: Props) {
  const id = programme.id;
  // Tri naturel : « Lot 2 » précède « Lot 10 » (T13).
  const sorted = sortByLotReference(lots, (l) => l.reference, sortDirection);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Grille des lots
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {programme.name} — {lots.length} lot{lots.length > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${basePath}/${id}/lots/export-pdf`}
            className="text-equatis-turquoise-700 inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
            download
          >
            Exporter (PDF)
          </a>
          <a
            href={`${basePath}/${id}/lots/export`}
            className="text-equatis-turquoise-700 inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
            download
          >
            Exporter (CSV)
          </a>
        </div>
      </div>

      {canCreateLot && (
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un lot</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateLotForm programmeId={id} />
          </CardContent>
        </Card>
      )}

      <Card>
        {lots.length === 0 ? (
          <EmptyState
            title="Aucun lot"
            description="Aucun lot n'est encore défini pour ce programme."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <LotReferenceHeader direction={sortDirection} />
                <Th>Surface habitable</Th>
                <Th>Surface annexe</Th>
                <Th>Surface utile SUV</Th>
                <Th>Étage</Th>
                <Th>Type</Th>
                <Th className="text-right">Prix HT</Th>
                <Th className="text-right">TVA</Th>
                <Th className="text-right">Prix TTC</Th>
                <Th>Statut</Th>
              </Tr>
            </THead>
            <TBody>
              {sorted.map((lot) => {
                const sb = LOT_STATUS_BADGE[lot.status];
                return (
                  <Tr key={lot.id}>
                    <Td className="font-mono">{lot.reference}</Td>
                    <Td>{lot.surface.toString()} m²</Td>
                    <Td>{surfaceLabel(lot.annexSurface)}</Td>
                    <Td>{surfaceLabel(lot.suv)}</Td>
                    <Td>{lot.floor ?? "—"}</Td>
                    <Td>{lot.type}</Td>
                    <Td className="text-right">
                      {eur.format(Number(lot.priceHT))}
                    </Td>
                    <Td className="text-right">{lot.vatRate.toString()} %</Td>
                    <Td className="text-right font-medium">
                      {eur.format(Number(lot.priceTTC))}
                    </Td>
                    <Td>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
