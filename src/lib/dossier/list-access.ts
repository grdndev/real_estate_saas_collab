import { prisma } from "@/lib/prisma";
import { dossierWhereForUser } from "@/lib/dossier/access";
import { decodePhone } from "@/lib/profile";
import { sortByLotReference } from "@/lib/lot/sort";
import { displayableEmail } from "@/lib/user/no-account";
import type { DossierRow } from "@/components/collab/dossiers-table";
import type { DossierFiltersInput } from "@/lib/dossier/schemas";
import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Résolution de la liste des dossiers, partagée par les espaces collaborateur
 * et admin (T5/T15). Le périmètre par rôle est calculé ici
 * (`dossierWhereForUser`) — jamais dans la vue.
 */

const PAGE_SIZE = 50;

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

export interface DossierListResult {
  total: number;
  totalPages: number;
  rows: DossierRow[];
  programmes: { id: string; name: string }[];
}

/**
 * Options du formulaire de création d'un dossier : programmes actifs,
 * collaborateurs actifs et clients associables (sans dossier actif).
 */
export async function loadDossierCreationOptions(currentUserId: string) {
  const [programmes, collaborators, pendingClients] = await Promise.all([
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        lots: {
          where: { status: "AVAILABLE" },
          orderBy: { reference: "asc" },
          select: { id: true, reference: true, type: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "COLLABORATOR", status: "ACTIVE", deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.user.findMany({
      where: {
        role: "CLIENT",
        // Tout client déjà utilisable et non rattaché à un dossier actif : les
        // clients inscrits + confirmés (PENDING_ASSOCIATION) mais aussi ceux
        // créés/importés par l'équipe (ACTIVE). Les dossiers archivés
        // (historique) ne bloquent pas une nouvelle association.
        status: { in: ["PENDING_ASSOCIATION", "ACTIVE", "NO_ACCOUNT"] },
        deletedAt: null,
        clientDossiers: { none: { archivedAt: null } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  // Pour le SUPER_ADMIN, qui n'est pas un collaborateur, on retombe sur le
  // premier collaborateur actif de la liste.
  const defaultCollaboratorId =
    collaborators.find((c) => c.id === currentUserId)?.id ??
    collaborators[0]?.id ??
    "";

  return { programmes, collaborators, pendingClients, defaultCollaboratorId };
}

export async function loadDossierList(
  userId: string,
  role: UserRole,
  filters: DossierFiltersInput,
): Promise<DossierListResult> {
  const conds: Prisma.DossierWhereInput[] = [
    dossierWhereForUser(userId, role, { includeArchived: filters.archives }),
  ];
  if (filters.status) conds.push({ status: filters.status });
  if (filters.programmeId) conds.push({ programmeId: filters.programmeId });
  if (filters.search) {
    conds.push({
      OR: [
        {
          client: {
            firstName: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          client: {
            lastName: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          programme: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ],
    });
  }
  const where: Prisma.DossierWhereInput = { AND: conds };
  const skip = (filters.page - 1) * PAGE_SIZE;

  const [total, dossiers, programmes] = await Promise.all([
    prisma.dossier.count({ where }),
    prisma.dossier.findMany({
      where,
      take: PAGE_SIZE,
      skip,
      include: {
        programme: { select: { name: true } },
        lots: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneEnc: true,
            status: true,
          },
        },
        participants: {
          where: { role: "COLLABORATOR_PRIMARY" },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Tri naturel sur la référence du lot (T13) : « Lot 2 » avant « Lot 10 ».
  const ordered = sortByLotReference(
    dossiers,
    (d) => d.lots[0]?.reference,
    filters.tri,
  );

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : null);

  const rows: DossierRow[] = ordered.map((d) => {
    const sb = STATUS_BADGE[d.status];
    const primary = d.participants[0]?.user;
    const lot = d.lots[0];
    const totalSurface = lot
      ? Number(lot.surface) + Number(lot.annexSurface ?? 0)
      : null;
    return {
      id: d.id,
      archived: d.archivedAt != null,
      clientHasNoAccount: d.client?.status === "NO_ACCOUNT",
      clientName: d.client
        ? `${d.client.firstName} ${d.client.lastName}`
        : null,
      clientPhone: d.client ? decodePhone(d.client.phoneEnc) || null : null,
      clientEmail: displayableEmail(d.client?.email),
      programmeName: d.programme.name,
      statusLabel: sb.label,
      statusVariant: sb.variant,
      responsable: primary ? `${primary.firstName} ${primary.lastName}` : null,
      lastActivity: fmt(d.lastActivityAt) ?? "—",

      building: lot?.building ?? null,
      reference: d.lots.map((l) => l.reference).join(", ") || null,
      floor: lot?.floor ?? null,
      type: lot?.type ?? null,
      surface: lot ? Number(lot.surface) : null,
      annexSurface: lot?.annexSurface != null ? Number(lot.annexSurface) : null,
      totalSurface,
      garden: lot?.garden != null ? Number(lot.garden) : null,
      priceNetVendeur:
        lot?.priceNetVendeur != null ? Number(lot.priceNetVendeur) : null,
      priceNetVendeurWithParking:
        lot?.priceNetVendeurWithParking != null
          ? Number(lot.priceNetVendeurWithParking)
          : null,
      commissionAgence:
        lot?.commissionAgence != null ? Number(lot.commissionAgence) : null,
      commissionAgenceParking:
        lot?.commissionAgenceParking != null
          ? Number(lot.commissionAgenceParking)
          : null,
      priceFAI: lot ? Number(lot.priceTTC) : null,
      priceLocation:
        lot?.priceLocation != null ? Number(lot.priceLocation) : null,
      creditImpot35:
        lot?.creditImpot35 != null ? Number(lot.creditImpot35) : null,
      priceRevientCrdImp:
        lot?.priceRevientCrdImp != null ? Number(lot.priceRevientCrdImp) : null,
      additionalParking: lot?.additionalParking ?? null,

      observation: d.observation,
      financingMode: d.financingMode,
      optionLabel: d.optioned
        ? `Oui${d.optionExpiresAt ? ` (jusqu'au ${fmt(d.optionExpiresAt)})` : ""}`
        : "Non",
      kbisObtainedAt: fmt(d.kbisObtainedAt),
      clientAtRsm: d.clientAtRsm,
      reservationSignedAt: fmt(d.reservationSignedAt),
      notaryTransmittedAt: fmt(d.notaryTransmittedAt),
      deposit200ReceivedAt: fmt(d.deposit200ReceivedAt),
      guaranteeDepositAmount:
        d.guaranteeDepositAmount != null
          ? Number(d.guaranteeDepositAmount)
          : null,
      guaranteeDepositReceivedAt: fmt(d.guaranteeDepositReceivedAt),
      rarSentByNotaryAt: fmt(d.rarSentByNotaryAt),
      loanFiledAt: fmt(d.loanFiledAt),
      loanObtainedAt: fmt(d.loanObtainedAt),
      reservationEndDate: fmt(d.reservationEndDate),
      actSignedAt: fmt(d.actSignedAt),
    };
  });

  return { total, totalPages, rows, programmes };
}
