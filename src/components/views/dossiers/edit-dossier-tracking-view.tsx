import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DossierTrackingForm,
  type DossierTrackingInitial,
} from "@/components/views/dossiers/dossier-tracking-form";
import { prisma } from "@/lib/prisma";

/**
 * Vue « modifier le suivi complémentaire » — implémentation unique partagée par
 * l'espace collaborateur et l'espace admin.
 *
 * Le contrôle d'accès au lot est fait par la route appelante
 * (`findLotForUser`) ; la vue ne connaît pas le rôle de l'utilisateur.
 */
interface Props {
  lotId: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

/**
 * `Date` Prisma → `YYYY-MM-DD` pour `<input type="date">`, lu en UTC comme les
 * dates sont écrites (cf. `trackingDate` dans `@/lib/dossier/actions`).
 */
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function EditDossierTrackingView({ lotId, basePath }: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      reference: true,
      programme: { select: { name: true } },
      dossier: true,
    },
  });
  if (!lot) notFound();

  // Le suivi complémentaire appartient au dossier : sans client associé, il n'y
  // a rien à modifier.
  const dossier = lot.dossier;
  if (!dossier) notFound();

  const initial: DossierTrackingInitial = {
    dossierId: dossier.id,
    observation: dossier.observation ?? "",
    financingMode: dossier.financingMode ?? "",
    kbisObtainedAt: ymd(dossier.kbisObtainedAt),
    clientAtRsm:
      dossier.clientAtRsm == null ? "" : dossier.clientAtRsm ? "oui" : "non",
    reservationSignedAt: ymd(dossier.reservationSignedAt),
    deposit200ReceivedAt: ymd(dossier.deposit200ReceivedAt),
    guaranteeDepositAmount:
      dossier.guaranteeDepositAmount != null
        ? Number(dossier.guaranteeDepositAmount)
        : null,
    guaranteeDepositReceivedAt: ymd(dossier.guaranteeDepositReceivedAt),
    rarSentByNotaryAt: ymd(dossier.rarSentByNotaryAt),
    loanFiledAt: ymd(dossier.loanFiledAt),
    loanObtainedAt: ymd(dossier.loanObtainedAt),
    reservationEndDate: ymd(dossier.reservationEndDate),
    actSignedAt: ymd(dossier.actSignedAt),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`${basePath}/${lot.id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au lot
        </Link>
        <p className="text-equatis-night-700 mt-2 text-xs uppercase">
          {lot.programme.name}
        </p>
        <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
          Suivi complémentaire — lot {lot.reference}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Les statuts, l&apos;option et le notaire se modifient depuis la fiche
          du lot : seules les dates brutes du process de vente sont saisies ici.
        </p>
      </div>

      <DossierTrackingForm
        tracking={initial}
        lotPath={`${basePath}/${lot.id}`}
      />
    </div>
  );
}
