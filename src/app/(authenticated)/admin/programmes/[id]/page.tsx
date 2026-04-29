import type { Metadata } from "next";
import Link from "next/link";
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
import { ArchiveProgrammeButton } from "@/components/admin/archive-programme";
import { CreateLotForm } from "@/components/admin/lot-form";
import { DeleteLotButton } from "@/components/admin/lot-row-actions";
import { PromoterAssignment } from "@/components/admin/promoter-assignment";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Détail programme" };

const STATUS_BADGE = {
  DRAFT: { label: "Brouillon", variant: "neutral" as const },
  ACTIVE: { label: "Actif", variant: "success" as const },
  ARCHIVED: { label: "Archivé", variant: "warning" as const },
};

const LOT_STATUS_BADGE = {
  AVAILABLE: { label: "Disponible", variant: "success" as const },
  RESERVED: { label: "Réservé", variant: "warning" as const },
  SOLD: { label: "Vendu", variant: "info" as const },
  WITHDRAWN: { label: "Retiré", variant: "neutral" as const },
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeDetailPage({ params }: PageProps) {
  const { id } = await params;

  const programme = await prisma.programme.findUnique({
    where: { id },
    include: {
      lots: { orderBy: [{ reference: "asc" }] },
      promoters: {
        include: {
          promoter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });
  if (!programme) notFound();

  const allPromoters = await prisma.user.findMany({
    where: { role: "PROMOTER", deletedAt: null, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { lastName: "asc" },
  });
  const assignedIds = new Set(programme.promoters.map((p) => p.promoterId));
  const availablePromoters = allPromoters.filter((p) => !assignedIds.has(p.id));
  const assignedPromoters = programme.promoters.map((pp) => pp.promoter);

  const badge = STATUS_BADGE[programme.status];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/programmes"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour à la liste
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-equatis-night-700 font-mono text-xs uppercase">
              {programme.reference}
            </p>
            <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
              {programme.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {programme.city && <span>{programme.city}</span>}
            </p>
          </div>
          {programme.status !== "ARCHIVED" && (
            <ArchiveProgrammeButton programmeId={programme.id} />
          )}
        </div>
      </div>

      {programme.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line text-slate-700">
              {programme.description}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Promoteurs assignés</CardTitle>
        </CardHeader>
        <CardContent>
          <PromoterAssignment
            programmeId={programme.id}
            assigned={assignedPromoters}
            available={availablePromoters}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lots ({programme.lots.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {programme.lots.length === 0 ? (
            <EmptyState
              title="Aucun lot"
              description="Ajoutez le premier lot du programme via le formulaire ci-dessous."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Réf.</Th>
                  <Th>Surface</Th>
                  <Th>Étage</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Prix HT</Th>
                  <Th className="text-right">TVA</Th>
                  <Th className="text-right">Prix TTC</Th>
                  <Th>Statut</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {programme.lots.map((lot) => {
                  const lb = LOT_STATUS_BADGE[lot.status];
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
                        <Badge variant={lb.variant}>{lb.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <DeleteLotButton lotId={lot.id} />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-equatis-night-800 mb-3 text-sm font-medium">
              Ajouter un lot
            </p>
            <CreateLotForm programmeId={programme.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
