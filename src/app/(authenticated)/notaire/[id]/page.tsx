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
import { Timeline } from "@/components/collab/timeline";
import {
  FlagMissingPieceForm,
  NotaryStatusActions,
} from "@/components/notary/notary-actions";
import { DocumentRowActions } from "@/components/storage/document-row-actions";
import { ScanStatusBadge } from "@/components/storage/scan-status-badge";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Détail dossier notaire" };

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotaireDossierDetailPage({ params }: PageProps) {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  const { id } = await params;

  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: {
      programme: true,
      lot: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      timelineEvents: { orderBy: { occurredAt: "desc" } },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          scanStatus: true,
          source: true,
          createdAt: true,
        },
      },
      documentRequests: {
        orderBy: [{ required: "desc" }, { createdAt: "asc" }],
        include: { documents: { select: { id: true } } },
      },
    },
  });
  if (!dossier) notFound();

  const actorIds = dossier.timelineEvents
    .map((e) => e.actorId)
    .filter((aid): aid is string => Boolean(aid));
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, a] as const));
  const timelineWithActors = dossier.timelineEvents.map((e) => ({
    ...e,
    actor: e.actorId ? (actorMap.get(e.actorId) ?? null) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/notaire"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux dossiers
        </Link>
        <p className="text-equatis-night-700 mt-2 font-mono text-xs uppercase">
          {dossier.reference}
        </p>
        <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
          {dossier.programme.name}
          {dossier.lot && (
            <span className="ml-2 text-base font-normal text-slate-500">
              · Lot {dossier.lot.reference}
            </span>
          )}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Référence</p>
                <p className="font-mono">{dossier.reference}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Programme</p>
                <p>{dossier.programme.name}</p>
              </div>
              {dossier.lot && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Surface</p>
                    <p>{dossier.lot.surface.toString()} m²</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Prix TTC</p>
                    <p>{eur.format(Number(dossier.lot.priceTTC))}</p>
                  </div>
                </>
              )}
              {dossier.client && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Acquéreur</p>
                    <p>
                      {dossier.client.firstName} {dossier.client.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p>{dossier.client.email}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs text-slate-500">Reçu le</p>
                <p>
                  {dossier.notaryTransmittedAt
                    ? dossier.notaryTransmittedAt.toLocaleDateString("fr-FR")
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Documents transmis ({dossier.documents.length})
              </CardTitle>
            </CardHeader>
            {dossier.documents.length === 0 ? (
              <EmptyState
                title="Aucun document"
                description="Aucun document n'a encore été déposé sur ce dossier."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Nom</Th>
                    <Th>Source</Th>
                    <Th>Taille</Th>
                    <Th>Scan</Th>
                    <Th>Date</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {dossier.documents.map((doc) => (
                    <Tr key={doc.id}>
                      <Td className="font-medium">{doc.fileName}</Td>
                      <Td className="text-xs text-slate-500">
                        {doc.source === "CLIENT_UPLOAD"
                          ? "Client"
                          : doc.source === "COLLABORATOR_UPLOAD"
                            ? "Collaborateur"
                            : doc.source}
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {(doc.sizeBytes / 1024).toFixed(0)} Ko
                      </Td>
                      <Td>
                        <ScanStatusBadge status={doc.scanStatus} />
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {doc.createdAt.toLocaleDateString("fr-FR")}
                      </Td>
                      <Td className="text-right">
                        <DocumentRowActions
                          documentId={doc.id}
                          scanStatus={doc.scanStatus}
                          canDelete={false}
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pièces demandées</CardTitle>
            </CardHeader>
            <CardContent>
              {dossier.documentRequests.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune pièce demandée.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {dossier.documentRequests.map((req) => {
                    const fulfilled = req.fulfilled || req.documents.length > 0;
                    return (
                      <li
                        key={req.id}
                        className="flex items-center justify-between py-2"
                      >
                        <span>
                          {req.label}
                          {req.required && (
                            <span className="ml-1 text-red-600">*</span>
                          )}
                        </span>
                        {fulfilled ? (
                          <Badge variant="success">Déposée</Badge>
                        ) : (
                          <Badge variant="warning">En attente</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={timelineWithActors} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <NotaryStatusActions dossierId={dossier.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signaler une pièce manquante</CardTitle>
            </CardHeader>
            <CardContent>
              <FlagMissingPieceForm dossierId={dossier.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
