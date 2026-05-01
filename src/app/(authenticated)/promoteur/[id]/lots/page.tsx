import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";

export const metadata: Metadata = { title: "Grille des lots" };

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const STATUS_BADGE = {
  AVAILABLE: { label: "Disponible", variant: "success" as const },
  RESERVED: { label: "Réservé", variant: "warning" as const },
  SOLD: { label: "Vendu", variant: "info" as const },
  WITHDRAWN: { label: "Retiré", variant: "neutral" as const },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeLotsPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;

  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const lots = await prisma.lot.findMany({
    where: { programmeId: id },
    orderBy: [{ floor: "asc" }, { reference: "asc" }],
  });

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
        <a
          href={`/promoteur/${id}/lots/export`}
          className="text-equatis-turquoise-700 inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
          download
        >
          Exporter (CSV)
        </a>
      </div>

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
                <Th>Lot</Th>
                <Th>Surface</Th>
                <Th>Étage</Th>
                <Th>Type</Th>
                <Th className="text-right">Prix HT</Th>
                <Th className="text-right">TVA</Th>
                <Th className="text-right">Prix TTC</Th>
                <Th>Statut</Th>
              </Tr>
            </THead>
            <TBody>
              {lots.map((lot) => {
                const sb = STATUS_BADGE[lot.status];
                return (
                  <Tr key={lot.id}>
                    <Td className="font-mono">{lot.reference}</Td>
                    <Td>{lot.surface.toString()} m²</Td>
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
        <CardContent className="border-t border-slate-100 text-xs text-slate-500">
          <CardHeader className="px-0 py-0">
            <CardTitle className="text-xs font-normal">
              Export PDF disponible en Phase 5 (audit + production).
            </CardTitle>
          </CardHeader>
        </CardContent>
      </Card>
    </div>
  );
}
