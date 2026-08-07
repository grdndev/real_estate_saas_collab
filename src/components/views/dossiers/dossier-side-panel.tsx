import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentManager } from "@/components/collab/appointment-manager";
import { AttachNotaryForm } from "@/components/collab/attach-notary";
import { ContractStatusCard } from "@/components/collab/contract-status-card";
import { DossierOptionCard } from "@/components/collab/dossier-option-card";
import { RelaunchNotaryButton } from "@/components/collab/relaunch-notary-button";
import { RequestSignatureBlock } from "@/components/collab/request-signature";
import { StatusTransition } from "@/components/collab/status-transition";
import { TransmitNotaryForm } from "@/components/collab/transmit-notary-form";
import { prisma } from "@/lib/prisma";
import { displayableEmail } from "@/lib/user/no-account";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const day = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : "—");

/**
 * Colonne latérale d'un dossier : suivi commercial et contractuel, équipe,
 * option, rendez-vous notaire et signature électronique.
 */
export async function DossierSidePanel({ dossierId }: { dossierId: string }) {
  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    include: {
      client: {
        select: { firstName: true, lastName: true, email: true, status: true },
      },
      appointments: { orderBy: { scheduledAt: "desc" } },
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
      documents: {
        where: { deletedAt: null, mimeType: "application/pdf" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          documentRequestId: true,
          reviewStatus: true,
        },
      },
      participants: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  const notaries = await prisma.user.findMany({
    where: { role: "NOTARY", status: "ACTIVE", deletedAt: null },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const client = dossier.client;
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

  const signableDocuments = dossier.documents.filter(
    (d) => d.documentRequestId === null || d.reviewStatus === "ACCEPTED",
  );

  const tracking: [string, string][] = [
    ["Mode de financement", dossier.financingMode ?? "—"],
    ["Observation", dossier.observation ?? "—"],
    ["Obtention Kbis", day(dossier.kbisObtainedAt)],
    [
      "Client chez RSM",
      dossier.clientAtRsm == null ? "—" : dossier.clientAtRsm ? "Oui" : "Non",
    ],
    ["Signature contrat de résa", day(dossier.reservationSignedAt)],
    ["Réception des 200€", day(dossier.deposit200ReceivedAt)],
    [
      "Dépôt de garantie",
      dossier.guaranteeDepositAmount != null
        ? eur.format(Number(dossier.guaranteeDepositAmount))
        : "—",
    ],
    ["Réception du dépôt de garantie", day(dossier.guaranteeDepositReceivedAt)],
    ["Envoi RAR par le notaire", day(dossier.rarSentByNotaryAt)],
    ["Dépôt de prêt", day(dossier.loanFiledAt)],
    ["Obtention de prêt", day(dossier.loanObtainedAt)],
    ["Date de fin de contrat de résa", day(dossier.reservationEndDate)],
    ["Acte", day(dossier.actSignedAt)],
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Suivi complémentaire</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            {tracking.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
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
          <CardTitle>Notaire du dossier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rattachement simple, sans transmission de documents (T4). */}
          <AttachNotaryForm
            dossierId={dossier.id}
            notaries={notaries}
            currentNotaryId={dossier.notaryId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {dossier.notaryId
              ? "Transmettre des pièces au notaire"
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
            clientName={`${client.firstName} ${client.lastName}`}
            recipients={[
              {
                role: "client" as const,
                label: `Client — ${client.firstName} ${client.lastName}`,
                firstName: client.firstName,
                lastName: client.lastName,
                // Client sans compte (T7) : l'adresse technique n'est jamais
                // pré-remplie — le collaborateur doit saisir une vraie adresse.
                email: displayableEmail(client.email) ?? "",
              },
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
            documents={signableDocuments.map((d) => ({
              id: d.id,
              fileName: d.fileName,
            }))}
            signatures={dossier.signatures}
            yousignReady={Boolean(process.env.YOUSIGN_API_KEY)}
          />
        </CardContent>
      </Card>
    </>
  );
}
