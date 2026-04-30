import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { dossierWhereForUser } from "@/lib/dossier/access";
import { getSettings } from "@/lib/settings";
import { maskName } from "@/lib/utils";

export const metadata: Metadata = { title: "Mon tableau de bord" };

const STATUS_BADGE = {
  NEW_LEAD: { label: "Nouveau lead", variant: "neutral" as const },
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

export default async function CollaborateurDashboardPage() {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const settings = await getSettings();
  const where = dossierWhereForUser(me.id, me.role);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const relaunchThreshold = new Date();
  relaunchThreshold.setDate(
    relaunchThreshold.getDate() - settings.RELAUNCH_DELAY_DAYS,
  );

  const [
    activeDossiers,
    signaturesPending,
    relaunchNeeded,
    actsThisMonth,
    recent,
  ] = await Promise.all([
    prisma.dossier.count({
      where: {
        AND: [where, { closedAt: null, status: { not: "ACT_SIGNED" } }],
      },
    }),
    prisma.dossier.count({
      where: { AND: [where, { status: "SIGNATURE_PENDING" }] },
    }),
    prisma.dossier.count({
      where: {
        AND: [
          where,
          { closedAt: null, lastActivityAt: { lt: relaunchThreshold } },
        ],
      },
    }),
    prisma.dossier.count({
      where: {
        AND: [where, { status: "ACT_SIGNED", closedAt: { gte: startOfMonth } }],
      },
    }),
    prisma.dossier.findMany({
      where,
      take: 5,
      orderBy: { lastActivityAt: "desc" },
      include: {
        programme: { select: { name: true, reference: true } },
        lot: { select: { reference: true } },
        client: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Bonjour {me.name?.split(" ")[0] ?? ""}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Vue de vos dossiers en cours.
          </p>
        </div>
        <Link href="/collaborateur/dossiers/nouveau">
          <Button>Nouveau dossier</Button>
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Dossiers en cours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {activeDossiers}
            </p>
            <p className="mt-1 text-xs text-slate-500">total actif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Signatures en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {signaturesPending}
            </p>
            <p className="mt-1 text-xs text-slate-500">à relancer si &gt; 5j</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Relances à effectuer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {relaunchNeeded}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              sans activité depuis {settings.RELAUNCH_DELAY_DAYS}j
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actes signés ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {actsThisMonth}
            </p>
            <p className="mt-1 text-xs text-slate-500">depuis le 1er du mois</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        {recent.length === 0 ? (
          <EmptyState
            title="Aucun dossier actif"
            description="Créez votre premier dossier pour commencer."
            action={
              <Link href="/collaborateur/dossiers/nouveau">
                <Button>Nouveau dossier</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Référence</Th>
                <Th>Client</Th>
                <Th>Programme</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th>Dernière activité</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {recent.map((d) => {
                const sb = STATUS_BADGE[d.status];
                return (
                  <Tr key={d.id}>
                    <Td className="font-mono text-xs">{d.reference}</Td>
                    <Td className="font-mono text-xs text-slate-600">
                      {d.client
                        ? maskName(`${d.client.firstName} ${d.client.lastName}`)
                        : "—"}
                    </Td>
                    <Td>{d.programme.name}</Td>
                    <Td>{d.lot?.reference ?? "—"}</Td>
                    <Td>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {d.lastActivityAt.toLocaleString("fr-FR")}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/collaborateur/dossiers/${d.id}`}
                        className="text-equatis-turquoise-700 text-sm hover:underline"
                      >
                        Ouvrir →
                      </Link>
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
