import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentRequestManager } from "@/components/collab/document-request-manager";
import { SharedNotes } from "@/components/notes/shared-notes";
import { Timeline } from "@/components/collab/timeline";
import { DocumentDropZone } from "@/components/storage/document-drop-zone";
import { DocumentRowActions } from "@/components/storage/document-row-actions";
import { ScanStatusBadge } from "@/components/storage/scan-status-badge";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage/s3";

/**
 * Colonne principale d'un dossier : timeline, pièces demandées, documents,
 * messagerie et notes d'équipe.
 *
 * Composant autonome : il ne s'affiche que lorsqu'un lot porte un dossier, et
 * ne connaît du lot que le chemin d'accès (`basePath/lotId`).
 */
interface Props {
  dossierId: string;
  currentUserId: string;
  /** Chemin de la fiche lot, ex. « /admin/lots/clx… ». */
  lotPath: string;
}

export async function DossierMainPanel({
  dossierId,
  currentUserId,
  lotPath,
}: Props) {
  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    include: {
      timelineEvents: { orderBy: { occurredAt: "desc" } },
      documentRequests: {
        orderBy: [{ required: "desc" }, { createdAt: "asc" }],
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              fileName: true,
              reviewStatus: true,
              reviewReason: true,
            },
          },
        },
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
          isShared: true,
          createdAt: true,
          documentRequestId: true,
          reviewStatus: true,
        },
      },
      client: { select: { status: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  const unreadMessages = await prisma.message.count({
    where: {
      dossierId,
      senderId: { not: currentUserId },
      NOT: { readBy: { has: currentUserId } },
    },
  });

  // « Documents du dossier » : documents hors demande, ou documents de demande
  // acceptés (revue par document). Les documents en attente/refusés restent
  // visibles dans le gestionnaire de demandes ci-dessous.
  const visibleDocuments = dossier.documents
    .filter(
      (doc) =>
        doc.documentRequestId === null || doc.reviewStatus === "ACCEPTED",
    )
    .sort((a, b) => Number(a.isShared) - Number(b.isShared));

  const storageReady = isStorageConfigured();
  const clientHasNoAccount = dossier.client.status === "NO_ACCOUNT";

  // Hydrate les acteurs de la timeline (1 requête supplémentaire pour éviter
  // une jointure complexe).
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

  const internal = visibleDocuments.filter((doc) => !doc.isShared);
  const shared = visibleDocuments.filter((doc) => doc.isShared);
  const renderRow = (doc: (typeof visibleDocuments)[number]) => (
    <li
      key={doc.id}
      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.fileName}</p>
        <p className="text-xs text-slate-500">
          {doc.source === "CLIENT_UPLOAD"
            ? "Déposé par le client"
            : doc.source === "COLLABORATOR_UPLOAD"
              ? "Déposé par l'équipe"
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
        isShared={doc.isShared}
        source={doc.source}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
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
              status: r.status,
              documents: r.documents.map((d) => ({
                id: d.id,
                fileName: d.fileName,
                reviewStatus: d.reviewStatus,
                reviewReason: d.reviewReason,
              })),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Documents du dossier ({visibleDocuments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleDocuments.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucun document n&apos;a encore été déposé.
            </p>
          ) : (
            <div className="text-sm">
              {internal.length > 0 && <ul>{internal.map(renderRow)}</ul>}
              {internal.length > 0 && shared.length > 0 && (
                <p className="mt-3 mb-1 border-t border-slate-400 pt-3 text-xs font-medium text-slate-500">
                  Partagés avec le client
                </p>
              )}
              {shared.length > 0 && <ul>{shared.map(renderRow)}</ul>}
            </div>
          )}

          {storageReady ? (
            <DocumentDropZone
              dossierId={dossier.id}
              source="COLLABORATOR_UPLOAD"
              label="Ajouter des documents au dossier"
              multiple={true}
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
            {unreadMessages > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                {unreadMessages} non lu{unreadMessages > 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={`${lotPath}/messagerie`}>
            <Button variant="outline">Ouvrir la conversation</Button>
          </Link>
          {clientHasNoAccount && (
            <p className="mt-2 text-xs text-slate-500">
              Ce client n&apos;a pas d&apos;accès à la plateforme : il ne peut
              ni lire ni écrire de message.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes de l&apos;équipe</CardTitle>
        </CardHeader>
        <CardContent>
          <SharedNotes
            scope="DOSSIER"
            targetId={dossier.id}
            currentUserId={currentUserId}
            notes={dossier.notes.map((n) => ({
              id: n.id,
              body: n.body,
              authorId: n.authorId,
              authorName: `${n.author.firstName} ${n.author.lastName}`,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
