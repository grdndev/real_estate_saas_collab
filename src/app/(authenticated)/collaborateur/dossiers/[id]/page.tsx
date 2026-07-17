import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignClientForm } from "@/components/collab/assign-client";
import { HonorairesPdfDialog } from "@/components/collab/honoraires-pdf-dialog";
import { DocumentRequestManager } from "@/components/collab/document-request-manager";
import { StatusTransition } from "@/components/collab/status-transition";
import { ContractStatusCard } from "@/components/collab/contract-status-card";
import { DossierOptionCard } from "@/components/collab/dossier-option-card";
import { AppointmentManager } from "@/components/collab/appointment-manager";
import { SharedNotes } from "@/components/notes/shared-notes";
import { Timeline } from "@/components/collab/timeline";
import { RequestSignatureBlock } from "@/components/collab/request-signature";
import { RelaunchClientButton } from "@/components/collab/relaunch-client-button";
import { UnassignClientButton } from "@/components/collab/unassign-client";
import { RelaunchNotaryButton } from "@/components/collab/relaunch-notary-button";
import { TransmitNotaryForm } from "@/components/collab/transmit-notary-form";
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
  SIGNED_AT_NOTARY: {
    label: "Envoyé chez le notaire",
    variant: "info" as const,
  },
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

  const [dossier, pendingClients, notaries, unreadMessages] = await Promise.all(
    [
      prisma.dossier.findUnique({
        where: { id },
        include: {
          programme: true,
          lots: true,
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
              uploadedById: true,
              documentRequestId: true,
              reviewStatus: true,
            },
          },
          signatures: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              signerEmail: true,
              signedAt: true,
              createdAt: true,
            },
          },
          client: { select: { firstName: true, lastName: true, email: true } },
          prospect: { select: { id: true } },
          notes: {
            orderBy: { createdAt: "desc" },
            include: {
              author: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          appointments: { orderBy: { scheduledAt: "desc" } },
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
      prisma.user.findMany({
        where: { role: "NOTARY", status: "ACTIVE", deletedAt: null },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.message.count({
        where: {
          dossierId: id,
          senderId: { not: me.id },
          NOT: { readBy: { has: me.id } },
        },
      }),
    ],
  );
  if (!dossier) notFound();

  const hasPendingSignature = dossier.signatures.some((s) =>
    ["CREATED", "SENT", "OPENED"].includes(s.status),
  );

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

  // Vendeur pré-rempli pour le PDF honoraires : 1er promoteur du programme.
  const firstPromoter = await prisma.programmePromoter.findFirst({
    where: { programmeId: dossier.programmeId },
    orderBy: { createdAt: "asc" },
    include: { promoter: { select: { firstName: true, lastName: true } } },
  });
  const defaultVendeurNom = firstPromoter
    ? `${firstPromoter.promoter.firstName} ${firstPromoter.promoter.lastName}`
    : "";

  // Pré-calcul (hors rendu) : nom du notaire assigné + jours depuis transmission.
  const notaryParticipant = dossier.participants.find(
    (p) => p.role === "NOTARY" && p.userId === dossier.notaryId,
  );
  const notaryDisplayName = notaryParticipant
    ? `${notaryParticipant.user.firstName} ${notaryParticipant.user.lastName}`
    : "le notaire";
  // eslint-disable-next-line react-hooks/purity -- Server Component : Date.now() OK à l'exécution serveur (1 call par requête HTTP)
  const nowMs = Date.now();
  const daysSinceTransmission = dossier.notaryTransmittedAt
    ? Math.max(
        1,
        Math.round(
          (nowMs - dossier.notaryTransmittedAt.getTime()) / (24 * 3600 * 1000),
        ),
      )
    : 0;

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
              {dossier.lots.length > 0 && (
                <span className="ml-2 text-base font-normal text-slate-500">
                  · Lot {dossier.lots.map((l) => l.reference).join(", ")}
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
                (() => {
                  const internal = visibleDocuments.filter(
                    (doc) => !doc.isShared,
                  );
                  const shared = visibleDocuments.filter((doc) => doc.isShared);
                  const renderRow = (
                    doc: (typeof visibleDocuments)[number],
                  ) => (
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
                    <div className="text-sm">
                      {internal.length > 0 && (
                        <ul>{internal.map(renderRow)}</ul>
                      )}
                      {internal.length > 0 && shared.length > 0 && (
                        <p className="mt-3 mb-1 border-t border-slate-400 pt-3 text-xs font-medium text-slate-500">
                          Partagés avec le client
                        </p>
                      )}
                      {shared.length > 0 && <ul>{shared.map(renderRow)}</ul>}
                    </div>
                  );
                })()
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

          <Card>
            <CardHeader>
              <CardTitle>Notes de l&apos;équipe</CardTitle>
            </CardHeader>
            <CardContent>
              <SharedNotes
                scope="DOSSIER"
                targetId={dossier.id}
                currentUserId={me.id}
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

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dossier.clientId ? (
                <>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">
                      {dossier.client
                        ? `${dossier.client.firstName} ${dossier.client.lastName}`
                        : "—"}
                    </p>
                  </div>
                  {dossier.client && (
                    <div className="border-t border-slate-100 pt-4">
                      <RelaunchClientButton
                        dossierId={dossier.id}
                        clientName={`${dossier.client.firstName} ${dossier.client.lastName}`}
                      />
                    </div>
                  )}
                  <div className="border-t border-slate-100 pt-4">
                    <Link
                      href={`/collaborateur/dossiers/${dossier.id}/fiche-client`}
                      className="text-equatis-turquoise-700 text-sm font-medium hover:underline"
                    >
                      → Fiche client complète
                    </Link>
                  </div>
                  {dossier.client && (
                    <div className="border-t border-slate-100 pt-4">
                      <UnassignClientButton
                        dossierId={dossier.id}
                        clientName={`${dossier.client.firstName} ${dossier.client.lastName}`}
                        convertedProspect={Boolean(dossier.prospect)}
                        pendingSignature={hasPendingSignature}
                      />
                    </div>
                  )}
                </>
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
              {dossier.lots.length > 0 ? (
                <>
                  <p className="font-mono">
                    {dossier.lots.map((l) => l.reference).join(", ")}
                  </p>
                  <p className="text-slate-600">
                    {dossier.lots
                      .map((l) => `${l.type} ${l.surface} m²`)
                      .join(", ")}
                  </p>
                  <p className="text-slate-600">
                    <strong>
                      {dossier.lots
                        .map((l) => eur.format(Number(l.priceTTC)))
                        .join(" + ")}
                    </strong>
                  </p>
                  <p className="text-slate-600">
                    Prix TTC :{" "}
                    <strong>
                      {eur.format(
                        dossier.lots.reduce(
                          (acc, l) => acc + Number(l.priceTTC),
                          0,
                        ),
                      )}
                    </strong>
                  </p>
                  {dossier.client && (
                    <div className="border-t border-slate-100 pt-3">
                      <HonorairesPdfDialog
                        dossierId={dossier.id}
                        defaultVendeurNom={defaultVendeurNom}
                      />
                    </div>
                  )}
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
              <CardTitle>Changer le statut commercial</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTransition
                dossierId={dossier.id}
                currentStatus={dossier.status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suivi contractuel</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractStatusCard
                dossierId={dossier.id}
                current={dossier.contractStatus}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Option du dossier</CardTitle>
            </CardHeader>
            <CardContent>
              <DossierOptionCard
                dossierId={dossier.id}
                optioned={dossier.optioned}
                optionExpiresAt={
                  dossier.optionExpiresAt
                    ? dossier.optionExpiresAt.toISOString()
                    : null
                }
                expired={
                  dossier.optionExpiresAt
                    ? dossier.optionExpiresAt.getTime() < nowMs
                    : false
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rendez-vous notaire</CardTitle>
            </CardHeader>
            <CardContent>
              <AppointmentManager
                dossierId={dossier.id}
                canManage
                appointments={dossier.appointments.map((a) => ({
                  id: a.id,
                  scheduledAt: a.scheduledAt.toISOString(),
                  location: a.location,
                  notes: a.notes,
                  status: a.status,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {dossier.notaryId
                  ? "Notaire assigné"
                  : "Transmettre au notaire"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TransmitNotaryForm
                dossierId={dossier.id}
                notaries={notaries}
                currentNotaryId={dossier.notaryId}
              />
              {dossier.notaryId && dossier.notaryTransmittedAt && (
                <div className="border-t border-slate-100 pt-4">
                  <RelaunchNotaryButton
                    dossierId={dossier.id}
                    notaryName={notaryDisplayName}
                    daysSinceTransmission={daysSinceTransmission}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signature électronique</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestSignatureBlock
                dossierId={dossier.id}
                reference={dossier.reference}
                recipients={[
                  ...(dossier.client
                    ? [
                        {
                          role: "client" as const,
                          label: `Client — ${dossier.client.firstName} ${dossier.client.lastName}`,
                          firstName: dossier.client.firstName,
                          lastName: dossier.client.lastName,
                          email: dossier.client.email,
                        },
                      ]
                    : []),
                  ...(notaryParticipant
                    ? [
                        {
                          role: "notary" as const,
                          label: `Notaire — ${notaryParticipant.user.firstName} ${notaryParticipant.user.lastName}`,
                          firstName: notaryParticipant.user.firstName,
                          lastName: notaryParticipant.user.lastName,
                          email: notaryParticipant.user.email,
                        },
                      ]
                    : []),
                ]}
                documents={visibleDocuments
                  .filter((d) => d.mimeType === "application/pdf")
                  .map((d) => ({ id: d.id, fileName: d.fileName }))}
                signatures={dossier.signatures}
                yousignReady={Boolean(process.env.YOUSIGN_API_KEY)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
