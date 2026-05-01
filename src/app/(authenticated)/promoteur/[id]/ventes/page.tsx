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

export const metadata: Metadata = { title: "Suivi des ventes" };

const STATUS_BADGE = {
  NEW_LEAD: { label: "Lead", variant: "neutral" as const },
  RESERVATION_SENT: { label: "Réservation envoyée", variant: "info" as const },
  SIGNATURE_PENDING: {
    label: "Signature en attente",
    variant: "warning" as const,
  },
  SIGNED_AT_NOTARY: { label: "Chez le notaire", variant: "info" as const },
  LOAN_OFFER_RECEIVED: {
    label: "Offre de prêt reçue",
    variant: "info" as const,
  },
  ACT_SIGNED: { label: "Acte signé", variant: "success" as const },
  BLOCKED: { label: "Bloqué", variant: "danger" as const },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeSalesPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const dossiers = await prisma.dossier.findMany({
    where: { programmeId: id },
    orderBy: { createdAt: "desc" },
    include: {
      lot: { select: { reference: true, type: true, surface: true } },
    },
  });

  const stats = dossiers.reduce(
    (acc, d) => {
      acc.byStatus[d.status] = (acc.byStatus[d.status] ?? 0) + 1;
      if (d.status === "ACT_SIGNED" && d.closedAt) {
        const days = Math.max(
          1,
          Math.round(
            (d.closedAt.getTime() - d.createdAt.getTime()) / (24 * 3600 * 1000),
          ),
        );
        acc.signedDurations.push(days);
      }
      return acc;
    },
    {
      byStatus: {} as Record<string, number>,
      signedDurations: [] as number[],
    },
  );

  const total = dossiers.length;
  const signed = stats.byStatus["ACT_SIGNED"] ?? 0;
  const conversion = total > 0 ? Math.round((signed / total) * 100) : 0;
  const avgDuration =
    stats.signedDurations.length > 0
      ? Math.round(
          stats.signedDurations.reduce((a, b) => a + b, 0) /
            stats.signedDurations.length,
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Suivi des ventes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {programme.name} — vue lecture seule, données personnelles masquées
          (CDC §5.7).
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Taux de conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {conversion}%
            </p>
            <p className="mt-1 text-xs text-slate-500">lead → acte signé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Durée moyenne lead → acte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {avgDuration ? `${avgDuration} j` : "—"}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Dossiers</CardTitle>
        </CardHeader>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier"
            description="Aucun dossier n'a encore été créé sur ce programme."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Référence</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th>Créé le</Th>
                <Th>Dernière activité</Th>
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => {
                const sb = STATUS_BADGE[d.status];
                return (
                  <Tr key={d.id}>
                    <Td className="font-mono text-xs">{d.reference}</Td>
                    <Td>
                      {d.lot ? `${d.lot.reference} · ${d.lot.type}` : "—"}
                    </Td>
                    <Td>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {d.createdAt.toLocaleDateString("fr-FR")}
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {d.lastActivityAt.toLocaleDateString("fr-FR")}
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
