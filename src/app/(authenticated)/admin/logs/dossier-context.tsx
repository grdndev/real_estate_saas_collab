import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DossierProgress } from "@/components/client-space/progress-bar";
import { Timeline } from "@/components/collab/timeline";
import type { getDossierContext } from "@/lib/admin/activity";
import {
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABEL,
} from "@/lib/dossier/labels";

type DossierContext = NonNullable<
  Awaited<ReturnType<typeof getDossierContext>>
>;

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

const LOT_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible",
  OPTIONED: "Optionné",
  RESERVED: "Réservé",
  SOLD: "Vendu",
  WITHDRAWN: "Retiré",
};

const PARTICIPANT_ROLE_LABEL: Record<string, string> = {
  COLLABORATOR_PRIMARY: "Collaborateur principal",
  COLLABORATOR_SECONDARY: "Collaborateur secondaire",
  NOTARY: "Notaire",
};

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-equatis-night-800 mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function DossierContextPanel({ dossier }: { dossier: DossierContext }) {
  const statusBadge = STATUS_BADGE[dossier.status];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between">
        <CardTitle>
          Dossier {dossier.client.firstName} {dossier.client.lastName}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          {dossier.contractStatus && (
            <Badge variant={CONTRACT_STATUS_BADGE[dossier.contractStatus]}>
              Contrat : {CONTRACT_STATUS_LABEL[dossier.contractStatus]}
            </Badge>
          )}
          {dossier.optioned && (
            <Badge variant="warning">
              Optionné
              {dossier.optionExpiresAt &&
                ` jusqu'au ${dossier.optionExpiresAt.toLocaleDateString("fr-FR")}`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Client">
            {dossier.client.firstName} {dossier.client.lastName}
          </Fact>
          <Fact label="Programme">
            <Link
              href={`/admin/logs?vue=programme&id=${dossier.lot.programme.id}`}
              className="text-equatis-turquoise-700 hover:underline"
            >
              {dossier.lot.programme.name}
            </Link>
          </Fact>
          <Fact label="Lot">
            {`${dossier.lot.reference} (${LOT_STATUS_LABEL[dossier.lot.status] ?? dossier.lot.status})`}
          </Fact>
          <Fact label="Intervenants">
            {dossier.participants.length === 0
              ? "—"
              : dossier.participants
                  .map(
                    (p) =>
                      `${p.user.firstName} ${p.user.lastName} (${PARTICIPANT_ROLE_LABEL[p.role] ?? p.role})`,
                  )
                  .join(", ")}
          </Fact>
          <Fact label="Créé le">
            {dossier.createdAt.toLocaleDateString("fr-FR")}
          </Fact>
          <Fact label="Dernière activité">
            {dossier.lastActivityAt.toLocaleString("fr-FR")}
          </Fact>
          <Fact label="Transmis au notaire">
            {dossier.notaryTransmittedAt
              ? dossier.notaryTransmittedAt.toLocaleDateString("fr-FR")
              : "—"}
          </Fact>
          <Fact label="Clôturé le">
            {dossier.closedAt
              ? dossier.closedAt.toLocaleDateString("fr-FR")
              : "—"}
          </Fact>
        </dl>

        <div>
          <p className="mb-2 text-xs tracking-wider text-slate-500 uppercase">
            Avancement commercial
          </p>
          <DossierProgress current={dossier.status} />
        </div>

        <div>
          <p className="mb-2 text-xs tracking-wider text-slate-500 uppercase">
            Événements du dossier ({dossier.timelineEvents.length})
          </p>
          <div className="max-h-80 overflow-y-auto pr-2">
            <Timeline events={dossier.timelineEvents} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
