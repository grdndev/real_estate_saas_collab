import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignClientForm } from "@/components/collab/assign-client";
import { DocumentRequestManager } from "@/components/collab/document-request-manager";
import { RevealNameButton } from "@/components/collab/reveal-name-button";
import { StatusTransition } from "@/components/collab/status-transition";
import { Timeline } from "@/components/collab/timeline";
import { DocumentDropZone } from "@/components/storage/document-drop-zone";
import { DocumentRowActions } from "@/components/storage/document-row-actions";
import { ScanStatusBadge } from "@/components/storage/scan-status-badge";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage/s3";

export const metadata: Metadata = { title: "Détail dossier" };

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

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DossierDetailPage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  const [dossier, pendingClients] = await Promise.all([
    prisma.dossier.findUnique({
      where: { id },
      include: {
        programme: true,
        lot: true,
        timelineEvents: { orderBy: { occurredAt: "desc" } },
        documentRequests: {
          orderBy: [{ required: "desc" }, { createdAt: "asc" }],
          include: { documents: { select: { id: true } } },
        },
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
            uploadedById: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "CLIENT",
        status: "PENDING_ASSOCIATION",
        deletedAt: null,
        clientDossier: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);
  if (!dossier) notFound();

  const storageReady = isStorageConfigured();

  // Hydrate les acteurs de la timeline (1 requête supplémentaire pour éviter une jointure complexe).
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

  const sb = STATUS_BADGE[dossier.status];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/collaborateur/dossiers"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux dossiers
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-equatis-night-700 font-mono text-xs uppercase">
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
            <p className="mt-2">
              <Badge variant={sb.variant}>{sb.label}</Badge>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={timelineWithActors} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pièces à demander au client</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentRequestManager
                dossierId={dossier.id}
                initial={dossier.documentRequests.map((r) => ({
                  id: r.id,
                  label: r.label,
                  required: r.required,
                  fulfilled: r.fulfilled,
                  hasDocument: r.documents.length > 0,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Documents du dossier ({dossier.documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dossier.documents.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun document n&apos;a encore été déposé.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {dossier.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{doc.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {doc.source === "CLIENT_UPLOAD"
                            ? "Déposé par le client"
                            : doc.source === "COLLABORATOR_UPLOAD"
                              ? "Partagé au client"
                              : doc.source}{" "}
                          · {(doc.sizeBytes / 1024).toFixed(0)} Ko ·{" "}
                          {doc.createdAt.toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <ScanStatusBadge status={doc.scanStatus} />
                      <DocumentRowActions
                        documentId={doc.id}
                        scanStatus={doc.scanStatus}
                        canDelete
                      />
                    </li>
                  ))}
                </ul>
              )}

              {storageReady ? (
                <DocumentDropZone
                  dossierId={dossier.id}
                  source="COLLABORATOR_UPLOAD"
                  label="Partager un document avec le client"
                  compact
                />
              ) : (
                <p className="text-xs text-slate-500">
                  Stockage S3 non configuré — renseignez les variables S3_* dans{" "}
                  <code>.env</code> pour activer l&apos;upload.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Messagerie
                {dossier._count.messages > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({dossier._count.messages} message
                    {dossier._count.messages > 1 ? "s" : ""})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/collaborateur/dossiers/${dossier.id}/messagerie`}>
                <Button variant="outline">Ouvrir la conversation</Button>
              </Link>
              {!dossier.clientId && (
                <p className="mt-2 text-xs text-slate-500">
                  La messagerie sera activée après l&apos;association d&apos;un
                  client.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              {dossier.clientId ? (
                <div className="space-y-2 text-sm">
                  <RevealNameButton
                    dossierId={dossier.id}
                    fallbackMasked="●●●●● ●●●●●●"
                  />
                  <p className="text-xs text-slate-500">
                    L&apos;affichage du nom est tracé dans le journal
                    d&apos;audit.
                  </p>
                </div>
              ) : (
                <AssignClientForm
                  dossierId={dossier.id}
                  pendingClients={pendingClients}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {dossier.lot ? (
                <>
                  <p className="font-mono">{dossier.lot.reference}</p>
                  <p className="text-slate-600">
                    {dossier.lot.surface.toString()} m² · {dossier.lot.type}
                  </p>
                  <p className="text-slate-600">
                    Prix TTC :{" "}
                    <strong>{eur.format(Number(dossier.lot.priceTTC))}</strong>
                  </p>
                </>
              ) : (
                <p className="text-slate-500">Aucun lot rattaché.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Équipe</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {dossier.participants.map((p) => (
                  <li
                    key={`${p.userId}-${p.role}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {p.user.firstName} {p.user.lastName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.role === "COLLABORATOR_PRIMARY"
                        ? "référent"
                        : p.role === "COLLABORATOR_SECONDARY"
                          ? "secondaire"
                          : "notaire"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changer le statut</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTransition
                dossierId={dossier.id}
                currentStatus={dossier.status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
