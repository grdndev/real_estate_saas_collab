import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Tableau de bord admin" };

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
  CLIENT: "Client",
} as const;

const STATUS_LABEL = {
  NEW_LEAD: "Nouveau lead",
  RESERVATION_SENT: "Réservation envoyée",
  SIGNATURE_PENDING: "Signature en attente",
  SIGNED_AT_NOTARY: "Chez le notaire",
  LOAN_OFFER_RECEIVED: "Offre de prêt reçue",
  ACT_SIGNED: "Acte signé",
  BLOCKED: "Bloqué",
} as const;

export default async function AdminDashboardPage() {
  const [
    usersCountByRole,
    activeUsers,
    dossiersByStatus,
    programmesCount,
    activeProgrammes,
    recentEvents,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.dossier.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.programme.count(),
    prisma.programme.count({ where: { status: "ACTIVE" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const totalUsers = usersCountByRole.reduce(
    (acc, row) => acc + row._count._all,
    0,
  );
  const totalDossiers = dossiersByStatus.reduce(
    (acc, row) => acc + row._count._all,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Vue globale de la plateforme Équatis.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {activeUsers}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              actifs sur {totalUsers} créés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Programmes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {activeProgrammes}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              actifs sur {programmesCount} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {totalDossiers}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              tous statuts confondus
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stockage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">—</p>
            <p className="mt-1 text-xs text-slate-500">disponible Phase 2</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs par rôle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {usersCountByRole.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun utilisateur.</p>
            ) : (
              usersCountByRole.map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">{ROLE_LABEL[row.role]}</span>
                  <Badge variant="primary">{row._count._all}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dossiers par statut</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dossiersByStatus.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun dossier.</p>
            ) : (
              dossiersByStatus.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">
                    {STATUS_LABEL[row.status]}
                  </span>
                  <Badge variant="primary">{row._count._all}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune activité enregistrée pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="text-equatis-night-800 font-mono text-xs">
                    {event.action}
                  </span>
                  <span className="text-slate-600">
                    {event.user
                      ? `${event.user.firstName} ${event.user.lastName}`
                      : "système"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {event.createdAt.toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-400">
        <Link
          href="/admin/utilisateurs/inviter"
          className="text-equatis-turquoise-700 hover:underline"
        >
          Inviter un nouvel utilisateur
        </Link>
        {" · "}
        <Link
          href="/admin/programmes/nouveau"
          className="text-equatis-turquoise-700 hover:underline"
        >
          Créer un programme
        </Link>
      </p>
    </div>
  );
}
