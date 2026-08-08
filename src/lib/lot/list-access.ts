import { prisma } from "@/lib/prisma";
import { decodePhone } from "@/lib/profile";
import { displayableEmail } from "@/lib/user/no-account";
import type { LotRow } from "@/components/lots/lots-table";
import type { LotFiltersInput } from "@/lib/lot/schemas";
import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Résolution de la liste des lots, partagée par les espaces collaborateur et
 * admin (T5/T15). Le périmètre par rôle est calculé ici — jamais dans la vue.
 *
 * La ligne est un LOT : il apparaît qu'il porte un dossier ou non. Les colonnes
 * « client », « statut commercial » et « suivi » proviennent du dossier ACTIF
 * du lot (`Lot.dossierId`) quand il existe.
 *
 * Le découpage se fait par curseur `reference|id` (T16). Le tri naturel des
 * références est assuré par la collation ICU posée sur `Lot.reference` (cf.
 * migration `lot_reference_natural_collation`) : « Lot 2 » précède « Lot 10 »
 * directement dans l'`ORDER BY`, ce qui est la condition pour qu'un curseur
 * soit stable. La paire (reference, id) donne un ordre total, donc aucune
 * ligne dupliquée ni escamotée entre deux tranches.
 */

/** Nombre de lots par tranche de scroll. */
export const LOT_CHUNK_SIZE = 50;

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

const LOT_STATUS_BADGE = {
  AVAILABLE: { label: "Disponible", variant: "success" as const },
  OPTIONED: { label: "Optionné", variant: "warning" as const },
  RESERVED: { label: "Réservé", variant: "info" as const },
  SOLD: { label: "Vendu", variant: "neutral" as const },
  WITHDRAWN: { label: "Retiré", variant: "danger" as const },
};

export interface LotPage {
  rows: LotRow[];
  /** Curseur de la tranche suivante, `null` s'il n'y a plus rien à charger. */
  nextCursor: string | null;
}

export interface LotListResult extends LotPage {
  total: number;
  programmes: { id: string; name: string }[];
}

/** Encode le curseur d'un lot. */
function encodeCursor(row: { reference: string; id: string }): string {
  return `${row.reference}|${row.id}`;
}

/**
 * Décode un curseur, `null` s'il est absent ou malformé.
 * La référence peut contenir un `|` ; l'identifiant, jamais (cuid).
 */
function decodeCursor(
  cursor: string | null,
): { reference: string; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf("|");
  if (separator === -1) return null;
  const reference = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  return id ? { reference, id } : null;
}

/** Le rôle a-t-il accès à la fiche lot interne ? */
function canListLots(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "COLLABORATOR";
}

/**
 * Options d'association d'un client : clients associables.
 *
 * Un client peut porter plusieurs dossiers actifs (un par lot) : aucun client
 * n'est donc exclu au motif qu'il est déjà associé ailleurs. Seuls les clients
 * dont le compte est inutilisable (email non confirmé, supprimé) sont écartés.
 */
export async function loadAssignableClients() {
  const clients = await prisma.user.findMany({
    where: {
      role: "CLIENT",
      status: { in: ["PENDING_ASSOCIATION", "ACTIVE", "NO_ACCOUNT"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  // L'adresse technique d'un client sans compte n'est jamais affichée (T7).
  return clients.map((c) => ({ ...c, email: displayableEmail(c.email) }));
}

/** Traduit les filtres de la liste en clause `where` Prisma. */
function buildLotWhere(filters: LotFiltersInput): Prisma.LotWhereInput {
  const conds: Prisma.LotWhereInput[] = [];
  if (filters.programmeId) conds.push({ programmeId: filters.programmeId });
  if (filters.lotStatus) conds.push({ status: filters.lotStatus });
  if (filters.associes) conds.push({ dossierId: { not: null } });
  if (filters.status) conds.push({ dossier: { status: filters.status } });
  if (filters.search) {
    conds.push({
      OR: [
        { reference: { contains: filters.search, mode: "insensitive" } },
        {
          programme: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          dossier: {
            client: {
              firstName: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
        {
          dossier: {
            client: {
              lastName: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }
  return conds.length > 0 ? { AND: conds } : {};
}

/**
 * Clause « strictement après le curseur » dans le sens de tri demandé.
 * `reference` porte la collation naturelle : la comparaison suit donc le même
 * ordre que l'`ORDER BY`, ce qui est indispensable pour ne rien sauter.
 */
function afterCursor(
  cursor: { reference: string; id: string },
  direction: "asc" | "desc",
): Prisma.LotWhereInput {
  const beyond = direction === "desc" ? "lt" : "gt";
  return {
    OR: [
      { reference: { [beyond]: cursor.reference } },
      {
        AND: [{ reference: cursor.reference }, { id: { [beyond]: cursor.id } }],
      },
    ],
  };
}

const LOT_INCLUDE = {
  programme: { select: { name: true } },
  dossier: {
    include: {
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
        where: { role: "COLLABORATOR_PRIMARY" as const },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.LotInclude;

type LotWithRelations = Prisma.LotGetPayload<{ include: typeof LOT_INCLUDE }>;

/**
 * Une tranche de lots à partir d'un curseur.
 * `cursor` à `null` renvoie la première tranche.
 */
export async function loadLotPage(
  role: UserRole,
  filters: LotFiltersInput,
  cursor: string | null,
): Promise<LotPage> {
  // La fiche lot interne est réservée à l'équipe : les autres rôles n'ont
  // aucune ligne (le client passe par son espace, le promoteur par sa grille).
  if (!canListLots(role)) return { rows: [], nextCursor: null };

  const decoded = decodeCursor(cursor);
  const where: Prisma.LotWhereInput = decoded
    ? { AND: [buildLotWhere(filters), afterCursor(decoded, filters.tri)] }
    : buildLotWhere(filters);

  const lots = await prisma.lot.findMany({
    where,
    // Ordre total : la référence donne le tri naturel, l'id départage les
    // références identiques d'un programme à l'autre.
    orderBy: [{ reference: filters.tri }, { id: filters.tri }],
    // Une ligne de plus que la tranche : sa présence indique qu'il reste à
    // charger, sans requête de comptage supplémentaire.
    take: LOT_CHUNK_SIZE + 1,
    include: LOT_INCLUDE,
  });

  const hasMore = lots.length > LOT_CHUNK_SIZE;
  const slice = hasMore ? lots.slice(0, LOT_CHUNK_SIZE) : lots;
  const last = slice[slice.length - 1];

  return {
    rows: slice.map(toLotRow),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

export async function loadLotList(
  role: UserRole,
  filters: LotFiltersInput,
): Promise<LotListResult> {
  if (!canListLots(role)) {
    return { total: 0, rows: [], nextCursor: null, programmes: [] };
  }

  const where = buildLotWhere(filters);

  const [total, page, programmes] = await Promise.all([
    prisma.lot.count({ where }),
    loadLotPage(role, filters, null),
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { total, ...page, programmes };
}

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : null);

/** Projette un lot et son dossier actif en ligne de tableau. */
function toLotRow(lot: LotWithRelations): LotRow {
  const d = lot.dossier;
  const sb = d ? STATUS_BADGE[d.status] : LOT_STATUS_BADGE[lot.status];
  const primary = d?.participants[0]?.user;
  const totalSurface = Number(lot.surface) + Number(lot.annexSurface ?? 0);
  return {
    id: lot.id,
    dossierId: d?.id ?? null,
    clientHasNoAccount: d?.client.status === "NO_ACCOUNT",
    clientName: d ? `${d.client.firstName} ${d.client.lastName}` : null,
    clientPhone: d ? decodePhone(d.client.phoneEnc) || null : null,
    clientEmail: d ? displayableEmail(d.client.email) : null,
    programmeName: lot.programme.name,
    statusLabel: sb.label,
    statusVariant: sb.variant,
    lotStatusLabel: LOT_STATUS_BADGE[lot.status].label,
    responsable: primary ? `${primary.firstName} ${primary.lastName}` : null,
    lastActivity: d ? (fmt(d.lastActivityAt) ?? "—") : "—",

    building: lot.building,
    reference: lot.reference,
    floor: lot.floor,
    type: lot.type,
    surface: Number(lot.surface),
    annexSurface: lot.annexSurface != null ? Number(lot.annexSurface) : null,
    totalSurface,
    garden: lot.garden != null ? Number(lot.garden) : null,
    priceNetVendeur:
      lot.priceNetVendeur != null ? Number(lot.priceNetVendeur) : null,
    priceNetVendeurWithParking:
      lot.priceNetVendeurWithParking != null
        ? Number(lot.priceNetVendeurWithParking)
        : null,
    commissionAgence:
      lot.commissionAgence != null ? Number(lot.commissionAgence) : null,
    commissionAgenceParking:
      lot.commissionAgenceParking != null
        ? Number(lot.commissionAgenceParking)
        : null,
    priceFAI: Number(lot.priceTTC),
    priceLocation: lot.priceLocation != null ? Number(lot.priceLocation) : null,
    creditImpot35: lot.creditImpot35 != null ? Number(lot.creditImpot35) : null,
    priceRevientCrdImp:
      lot.priceRevientCrdImp != null ? Number(lot.priceRevientCrdImp) : null,
    additionalParking: lot.additionalParking,

    observation: d?.observation ?? null,
    financingMode: d?.financingMode ?? null,
    optionLabel: d?.optioned
      ? `Oui${d.optionExpiresAt ? ` (jusqu'au ${fmt(d.optionExpiresAt)})` : ""}`
      : "Non",
    kbisObtainedAt: fmt(d?.kbisObtainedAt ?? null),
    clientAtRsm: d?.clientAtRsm ?? null,
    reservationSignedAt: fmt(d?.reservationSignedAt ?? null),
    notaryTransmittedAt: fmt(d?.notaryTransmittedAt ?? null),
    deposit200ReceivedAt: fmt(d?.deposit200ReceivedAt ?? null),
    guaranteeDepositAmount:
      d?.guaranteeDepositAmount != null
        ? Number(d.guaranteeDepositAmount)
        : null,
    guaranteeDepositReceivedAt: fmt(d?.guaranteeDepositReceivedAt ?? null),
    rarSentByNotaryAt: fmt(d?.rarSentByNotaryAt ?? null),
    loanFiledAt: fmt(d?.loanFiledAt ?? null),
    loanObtainedAt: fmt(d?.loanObtainedAt ?? null),
    reservationEndDate: fmt(d?.reservationEndDate ?? null),
    actSignedAt: fmt(d?.actSignedAt ?? null),
  };
}
