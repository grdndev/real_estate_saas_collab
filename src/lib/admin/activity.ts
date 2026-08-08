import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Journal d'activité — découpage par curseur `createdAt|id` (T16).
 *
 * La table grossit indéfiniment : le chargement doit rester paresseux côté
 * serveur, contrairement aux listes bornées qui se contentent d'une révélation
 * progressive à l'affichage. La clé composite (createdAt, id) donne un ordre
 * total, donc un curseur stable même quand plusieurs entrées partagent la même
 * milliseconde — ce qu'un `skip` numérique ne garantit pas dès qu'une ligne
 * est insérée entre deux tranches.
 */

/** Nombre d'entrées par tranche de scroll. */
export const ACTIVITY_CHUNK_SIZE = 50;

export type ActivityVue = "tout" | "utilisateur" | "programme" | "dossier";

export interface ActivityFilters {
  action?: string;
  from?: Date;
  to?: Date;
}

export type ActivityLogEntry = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { firstName: true; lastName: true; role: true } };
  };
}>;

export interface ActivityPage {
  logs: ActivityLogEntry[];
  /** Curseur de la tranche suivante, `null` s'il n'y a plus rien à charger. */
  nextCursor: string | null;
  /**
   * Nombre total d'entrées du périmètre. Compté pour la première tranche
   * seulement : le refaire à chaque scroll coûterait un balayage complet.
   */
  total: number | null;
}

/** Encode le curseur d'une entrée de journal. */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

/** Décode un curseur, `null` s'il est absent ou malformé. */
function decodeCursor(
  cursor: string | null,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf("|");
  if (separator === -1) return null;
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

function filtersWhere(filters: ActivityFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  return where;
}

async function queryLogs(
  scope: Prisma.AuditLogWhereInput,
  filters: ActivityFilters,
  cursor: string | null,
): Promise<ActivityPage> {
  const decoded = decodeCursor(cursor);
  const where: Prisma.AuditLogWhereInput = {
    AND: [
      scope,
      filtersWhere(filters),
      // Strictement « après » le curseur dans l'ordre décroissant : soit une
      // date antérieure, soit la même date et un id plus petit.
      ...(decoded
        ? [
            {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { lt: decoded.id } },
              ],
            } satisfies Prisma.AuditLogWhereInput,
          ]
        : []),
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // Une ligne de plus que la tranche : sa présence indique qu'il reste à
      // charger, sans requête de comptage supplémentaire.
      take: ACTIVITY_CHUNK_SIZE + 1,
      include: {
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    }),
    // Le total n'a de sens qu'en tête de liste : il sert à l'en-tête, pas à la
    // pagination, et un `count` par tranche balaierait toute la table.
    decoded ? Promise.resolve(null) : countLogs(scope, filters),
  ]);

  const hasMore = rows.length > ACTIVITY_CHUNK_SIZE;
  const logs = hasMore ? rows.slice(0, ACTIVITY_CHUNK_SIZE) : rows;
  const last = logs[logs.length - 1];

  return {
    logs,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    total,
  };
}

function countLogs(
  scope: Prisma.AuditLogWhereInput,
  filters: ActivityFilters,
): Promise<number> {
  return prisma.auditLog.count({
    where: { AND: [scope, filtersWhere(filters)] },
  });
}

const EMPTY_PAGE: ActivityPage = { logs: [], nextCursor: null, total: 0 };

/** Toute l'activité, tous axes confondus. */
export async function getRecentActivity(
  filters: ActivityFilters,
  cursor: string | null = null,
): Promise<ActivityPage> {
  return queryLogs({}, filters, cursor);
}

/** Activité d'un utilisateur donné (logs dont il est l'acteur). */
export async function getUserActivity(
  userId: string,
  filters: ActivityFilters,
  cursor: string | null = null,
): Promise<ActivityPage> {
  return queryLogs({ userId }, filters, cursor);
}

/** L'entité visée par la vue existe-t-elle encore ? */
async function scopeExists(vue: ActivityVue, id: string): Promise<boolean> {
  const select = { id: true };
  if (vue === "utilisateur") {
    return (await prisma.user.findUnique({ where: { id }, select })) !== null;
  }
  if (vue === "programme") {
    return (
      (await prisma.programme.findUnique({ where: { id }, select })) !== null
    );
  }
  if (vue === "dossier") {
    return (
      (await prisma.dossier.findUnique({ where: { id }, select })) !== null
    );
  }
  return false;
}

/**
 * Tranche de journal pour le périmètre demandé, avec repli sur toute
 * l'activité quand l'entité visée n'existe pas.
 *
 * Point d'entrée unique de la route et de l'action de scroll : c'est ce qui
 * garantit qu'une tranche suivante porte bien sur le même périmètre que la
 * première.
 */
export async function loadActivityPage(
  vue: ActivityVue,
  id: string,
  filters: ActivityFilters,
  cursor: string | null = null,
): Promise<ActivityPage> {
  if (vue !== "tout" && id && (await scopeExists(vue, id))) {
    if (vue === "utilisateur") return getUserActivity(id, filters, cursor);
    if (vue === "programme") return getProgrammeActivity(id, filters, cursor);
    return getDossierActivity(id, filters, cursor);
  }
  return getRecentActivity(filters, cursor);
}

/**
 * Actions réalisées sur un dossier : logs portant sur le dossier lui-même
 * ou sur ses entités liées (documents, demandes de pièces, messages,
 * signatures, RDV, factures, notes, lots, fiche client, prospect converti).
 * Limite connue : les entités supprimées physiquement ne sont plus
 * résolubles — leurs logs passés n'apparaissent que via le dossier direct.
 */
export async function getDossierActivity(
  dossierId: string,
  filters: ActivityFilters,
  cursor: string | null = null,
): Promise<ActivityPage> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      clientId: true,
      documents: { select: { id: true } },
      documentRequests: { select: { id: true } },
      messages: { select: { id: true } },
      signatures: { select: { id: true } },
      appointments: { select: { id: true } },
      invoices: { select: { id: true } },
      notes: { select: { id: true } },
      lot: { select: { id: true } },
      prospect: { select: { id: true } },
      client: { select: { clientProfile: { select: { id: true } } } },
    },
  });
  if (!dossier) return EMPTY_PAGE;

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const scopes: Prisma.AuditLogWhereInput[] = [
    { resourceType: "Dossier", resourceId: dossierId },
  ];
  const push = (resourceType: string, resourceIds: string[]) => {
    if (resourceIds.length > 0) {
      scopes.push({ resourceType, resourceId: { in: resourceIds } });
    }
  };
  push("Document", ids(dossier.documents));
  push("DocumentRequest", ids(dossier.documentRequests));
  push("Message", ids(dossier.messages));
  push("Signature", ids(dossier.signatures));
  push("Appointment", ids(dossier.appointments));
  push("Invoice", ids(dossier.invoices));
  push("Note", ids(dossier.notes));
  push("Lot", [dossier.lot.id]);
  if (dossier.prospect) push("Prospect", [dossier.prospect.id]);
  if (dossier.client?.clientProfile) {
    push("ClientProfile", [dossier.client.clientProfile.id]);
  }

  return queryLogs({ OR: scopes }, filters, cursor);
}

/**
 * Actions réalisées sur un programme : logs portant sur le programme
 * lui-même, ses lots, ses documents, ses prospects, son suivi des fonds,
 * ainsi que les actions de niveau dossier de ses dossiers (le détail d'un
 * dossier se consulte via l'axe dossier).
 */
export async function getProgrammeActivity(
  programmeId: string,
  filters: ActivityFilters,
  cursor: string | null = null,
): Promise<ActivityPage> {
  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
    select: {
      // Les dossiers d'un programme passent désormais par ses lots.
      lots: { select: { id: true, dossiers: { select: { id: true } } } },
      documents: { select: { id: true } },
      prospects: { select: { id: true } },
      lotFondsSuivis: { select: { id: true } },
      appelsFonds: { select: { id: true } },
    },
  });
  if (!programme) return EMPTY_PAGE;

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const scopes: Prisma.AuditLogWhereInput[] = [
    { resourceType: "Programme", resourceId: programmeId },
  ];
  const push = (resourceType: string, resourceIds: string[]) => {
    if (resourceIds.length > 0) {
      scopes.push({ resourceType, resourceId: { in: resourceIds } });
    }
  };
  push("Lot", ids(programme.lots));
  push("ProgrammeDocument", ids(programme.documents));
  push("Prospect", ids(programme.prospects));
  push(
    "Dossier",
    programme.lots.flatMap((l) => ids(l.dossiers)),
  );
  push("LotFondsSuivi", ids(programme.lotFondsSuivis));
  push("AppelFonds", ids(programme.appelsFonds));

  return queryLogs({ OR: scopes }, filters, cursor);
}

/** État actuel d'un utilisateur pour le panneau contextuel de la vue Activité. */
export async function getUserContext(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

/** État actuel d'un dossier pour le panneau contextuel de la vue Activité. */
export async function getDossierContext(dossierId: string) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      id: true,
      status: true,
      contractStatus: true,
      optioned: true,
      optionExpiresAt: true,
      createdAt: true,
      lastActivityAt: true,
      notaryTransmittedAt: true,
      closedAt: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      lot: {
        select: {
          id: true,
          reference: true,
          status: true,
          programme: { select: { id: true, name: true } },
        },
      },
      participants: {
        select: {
          role: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      timelineEvents: {
        orderBy: { occurredAt: "desc" },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          occurredAt: true,
          actorId: true,
        },
      },
    },
  });
  if (!dossier) return null;

  const actorIds = [
    ...new Set(
      dossier.timelineEvents
        .map((e) => e.actorId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return {
    ...dossier,
    timelineEvents: dossier.timelineEvents.map((e) => ({
      ...e,
      actor: e.actorId ? (actorById.get(e.actorId) ?? null) : null,
    })),
  };
}

/** État actuel d'un programme pour le panneau contextuel de la vue Activité. */
export async function getProgrammeContext(programmeId: string) {
  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      totalLots: true,
      createdAt: true,
      archivedAt: true,
      promoters: {
        select: { promoter: { select: { firstName: true, lastName: true } } },
      },
      lots: {
        select: { status: true, dossier: { select: { status: true } } },
      },
    },
  });
  if (!programme) return null;

  const countBy = <T extends string>(values: T[]) => {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return counts;
  };

  return {
    ...programme,
    lotCounts: countBy(programme.lots.map((l) => l.status)),
    // Dossiers ACTIFS du programme : un par lot associé.
    dossierCounts: countBy(
      programme.lots
        .map((l) => l.dossier?.status)
        .filter((s): s is NonNullable<typeof s> => s != null),
    ),
  };
}

/** Listes pour les sélecteurs d'entité de la page Activité. */
export async function getActivityEntities() {
  const [users, programmes, dossiers] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    prisma.programme.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.dossier.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        client: { select: { firstName: true, lastName: true } },
        lot: { select: { programme: { select: { name: true } } } },
      },
    }),
  ]);
  return { users, programmes, dossiers };
}
