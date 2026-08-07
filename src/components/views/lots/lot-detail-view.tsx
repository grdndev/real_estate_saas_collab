import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { DossierClientCard } from "@/components/views/dossiers/dossier-client-card";
import { DossierMainPanel } from "@/components/views/dossiers/dossier-main-panel";
import { DossierSidePanel } from "@/components/views/dossiers/dossier-side-panel";
import { LotDossierHistoryCard } from "@/components/views/lots/lot-dossier-history-card";
import { LotInfoCard } from "@/components/views/lots/lot-info-card";
import { prisma } from "@/lib/prisma";
import { LOT_STATUS_BADGE } from "@/lib/lot/labels";

const DOSSIER_STATUS_BADGE = {
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

/**
 * Vue « fiche lot » — implémentation unique partagée par l'espace collaborateur
 * et l'espace admin (T5/T15).
 *
 * Le lot est toujours consultable : les informations immobilières s'affichent
 * seules quand aucun client n'est associé. Dès qu'un dossier existe, ses
 * panneaux (timeline, documents, suivi, notaire…) viennent s'y greffer.
 *
 * Le contrôle d'accès au lot est fait par la route appelante
 * (`findLotForUser`) ; la vue ne connaît pas le rôle de l'utilisateur.
 */
interface Props {
  lotId: string;
  currentUserId: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

export async function LotDetailView({ lotId, currentUserId, basePath }: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      programme: { select: { id: true, name: true } },
      dossier: {
        select: {
          id: true,
          status: true,
          client: { select: { firstName: true, lastName: true, status: true } },
        },
      },
    },
  });
  if (!lot) notFound();

  const dossier = lot.dossier;
  const lotPath = `${basePath}/${lot.id}`;
  const lotBadge = LOT_STATUS_BADGE[lot.status];
  const dossierBadge = dossier ? DOSSIER_STATUS_BADGE[dossier.status] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={basePath}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux lots
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-equatis-night-700 flex items-center gap-2 text-xs uppercase">
              {lot.programme.name}
            </p>
            <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
              Lot {lot.reference}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={lotBadge.variant}>{lotBadge.label}</Badge>
              {dossierBadge && (
                <Badge variant={dossierBadge.variant}>
                  {dossierBadge.label}
                </Badge>
              )}
              {dossier?.client.status === "NO_ACCOUNT" && (
                <Badge variant="neutral">Client sans compte</Badge>
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {dossier
                ? `Acquéreur : ${dossier.client.firstName} ${dossier.client.lastName}`
                : "Aucun client associé à ce lot."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {dossier ? (
            <DossierMainPanel
              dossierId={dossier.id}
              currentUserId={currentUserId}
              lotPath={lotPath}
            />
          ) : (
            <LotInfoCard lot={lot} lotPath={lotPath} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <DossierClientCard
            lotId={lot.id}
            dossierId={dossier?.id ?? null}
            lotPath={lotPath}
          />
          {dossier && <LotInfoCard lot={lot} lotPath={lotPath} />}
          {dossier && <DossierSidePanel dossierId={dossier.id} />}
          <LotDossierHistoryCard lotId={lot.id} />
        </div>
      </div>
    </div>
  );
}
