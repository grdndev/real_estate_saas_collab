import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilters {
  action?: string;
  from?: Date;
  to?: Date;
  page: number;
}

export type ActivityLogEntry = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { firstName: true; lastName: true; role: true } };
  };
}>;

export interface ActivityPage {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  pageCount: number;
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
): Promise<ActivityPage> {
  const where: Prisma.AuditLogWhereInput = {
    AND: [scope, filtersWhere(filters)],
  };
  const page = Math.max(0, filters.page);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      include: {
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    logs,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
  };
}

/** Toute l'activité, tous axes confondus. */
export async function getRecentActivity(
  filters: ActivityFilters,
): Promise<ActivityPage> {
  return queryLogs({}, filters);
}

/** Activité d'un utilisateur donné (logs dont il est l'acteur). */
export async function getUserActivity(
  userId: string,
  filters: ActivityFilters,
): Promise<ActivityPage> {
  return queryLogs({ userId }, filters);
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
      lots: { select: { id: true } },
      prospect: { select: { id: true } },
      client: { select: { clientProfile: { select: { id: true } } } },
    },
  });
  if (!dossier) return { logs: [], total: 0, page: 0, pageCount: 1 };

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
  push("Lot", ids(dossier.lots));
  if (dossier.prospect) push("Prospect", [dossier.prospect.id]);
  if (dossier.client?.clientProfile) {
    push("ClientProfile", [dossier.client.clientProfile.id]);
  }

  return queryLogs({ OR: scopes }, filters);
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
): Promise<ActivityPage> {
  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
    select: {
      lots: { select: { id: true } },
      documents: { select: { id: true } },
      prospects: { select: { id: true } },
      dossiers: { select: { id: true } },
      lotFondsSuivis: {
        select: { id: true, appelsFonds: { select: { id: true } } },
      },
    },
  });
  if (!programme) return { logs: [], total: 0, page: 0, pageCount: 1 };

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
  push("Dossier", ids(programme.dossiers));
  push("LotFondsSuivi", ids(programme.lotFondsSuivis));
  push(
    "AppelFonds",
    programme.lotFondsSuivis.flatMap((s) => ids(s.appelsFonds)),
  );

  return queryLogs({ OR: scopes }, filters);
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
      reference: true,
      status: true,
      contractStatus: true,
      optioned: true,
      optionExpiresAt: true,
      createdAt: true,
      lastActivityAt: true,
      notaryTransmittedAt: true,
      closedAt: true,
      programme: { select: { id: true, reference: true, name: true } },
      client: { select: { firstName: true, lastName: true, email: true } },
      lots: { select: { id: true, reference: true, status: true } },
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
      reference: true,
      name: true,
      city: true,
      status: true,
      totalLots: true,
      createdAt: true,
      archivedAt: true,
      promoters: {
        select: { promoter: { select: { firstName: true, lastName: true } } },
      },
      lots: { select: { status: true } },
      dossiers: { select: { status: true } },
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
    dossierCounts: countBy(programme.dossiers.map((d) => d.status)),
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
      select: { id: true, reference: true, name: true },
    }),
    prisma.dossier.findMany({
      orderBy: { reference: "asc" },
      select: {
        id: true,
        reference: true,
        client: { select: { firstName: true, lastName: true } },
        programme: { select: { name: true } },
      },
    }),
  ]);
  return { users, programmes, dossiers };
}
