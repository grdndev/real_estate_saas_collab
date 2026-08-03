import { prisma } from "@/lib/prisma";
import type { ContractStatus, DossierStatus } from "@/generated/prisma/enums";

/**
 * Résolution des données des vues « suivi de programme » (tableau de bord,
 * grille & lots, trésorerie, ventes, contrats), partagées entre l'espace
 * promoteur et l'espace admin (T3/T15).
 *
 * L'identité du client est un paramètre explicite : le promoteur ne doit voir
 * aucune donnée nominative (T1), l'admin la conserve. Le choix est fait par la
 * route appelante, jamais déduit du rôle à l'intérieur d'une vue.
 */
export interface ClientIdentityOption {
  withClientIdentity: boolean;
}

/** Liste des programmes (section « Programmes » admin et collaborateur). */
export async function loadProgrammesList() {
  return prisma.programme.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      _count: { select: { lots: true, dossiers: true, promoters: true } },
    },
  });
}

/** Détail d'un programme : lots, dossiers rattachés et promoteurs assignés. */
export async function loadProgrammeDetail(programmeId: string) {
  return prisma.programme.findUnique({
    where: { id: programmeId },
    include: {
      lots: {
        orderBy: [{ reference: "asc" }],
        include: {
          dossier: {
            select: {
              id: true,
              clientId: true,
              client: { select: { firstName: true, lastName: true } },
              prospect: { select: { id: true } },
              signatures: {
                where: { status: { in: ["CREATED", "SENT", "OPENED"] } },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      },
      promoters: {
        include: {
          promoter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });
}

export type ProgrammeDetail = NonNullable<
  Awaited<ReturnType<typeof loadProgrammeDetail>>
>;

/** Promoteurs actifs non encore assignés au programme. */
export async function loadAvailablePromoters(assignedIds: Set<string>) {
  const all = await prisma.user.findMany({
    where: { role: "PROMOTER", deletedAt: null, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { lastName: "asc" },
  });
  return all.filter((p) => !assignedIds.has(p.id));
}

/** 12 mois glissants (UTC) à partir du mois courant. */
export function rollingMonths(count = 12): Date[] {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + idx);
    return d;
  });
}

/** Tableau de bord : lots agrégés + documents du programme. */
export async function loadProgrammeDashboard(programmeId: string) {
  const [lots, documents] = await Promise.all([
    prisma.lot.findMany({
      where: { programmeId },
      select: { surface: true, priceTTC: true, status: true },
    }),
    prisma.programmeDocument.findMany({
      where: { programmeId },
      select: {
        id: true,
        fileName: true,
        category: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { lots, documents };
}

/** Grille des lots d'un programme. */
export async function loadProgrammeLots(programmeId: string) {
  return prisma.lot.findMany({
    where: { programmeId },
    orderBy: [{ floor: "asc" }, { reference: "asc" }],
  });
}

/** Trésorerie prévisionnelle : écritures mensuelles + lots pour la synthèse. */
export async function loadProgrammeTreasury(
  programmeId: string,
  months: Date[],
) {
  const first = months[0];
  const last = months[months.length - 1];
  return Promise.all([
    prisma.tresoreriePrev.findMany({
      where: {
        programmeId,
        ...(first && last ? { month: { gte: first, lte: last } } : {}),
      },
    }),
    prisma.lot.findMany({
      where: { programmeId },
      select: { status: true, priceTTC: true },
    }),
  ]);
}

export interface ProgrammeSalesRow {
  id: string;
  status: DossierStatus;
  createdAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
  lots: { reference: string; type: string }[];
  /** `null` quand l'identité client est masquée (promoteur) ou absente. */
  clientName: string | null;
}

/** Suivi des ventes : dossiers actifs du programme. */
export async function loadProgrammeSales(
  programmeId: string,
  { withClientIdentity }: ClientIdentityOption,
): Promise<ProgrammeSalesRow[]> {
  const where = { programmeId, archivedAt: null };
  const orderBy = { createdAt: "desc" } as const;

  // Deux requêtes distinctes : quand l'identité est masquée, aucune donnée
  // nominative n'est extraite de la base (et pas seulement masquée à l'écran).
  if (!withClientIdentity) {
    const rows = await prisma.dossier.findMany({
      where,
      orderBy,
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastActivityAt: true,
        closedAt: true,
        lots: { select: { reference: true, type: true } },
      },
    });
    return rows.map((d) => ({ ...d, clientName: null }));
  }

  const rows = await prisma.dossier.findMany({
    where,
    orderBy,
    select: {
      id: true,
      status: true,
      createdAt: true,
      lastActivityAt: true,
      closedAt: true,
      lots: { select: { reference: true, type: true } },
      client: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map(({ client, ...d }) => ({
    ...d,
    clientName: client ? `${client.firstName} ${client.lastName}` : null,
  }));
}

export interface ProgrammeContractRow {
  id: string;
  contractStatus: ContractStatus | null;
  lots: { reference: string; type: string }[];
  signedAt: Date | null;
  hasSignature: boolean;
  nextAppointmentAt: Date | null;
  /** `null` quand l'identité client est masquée (promoteur) ou absente. */
  clientName: string | null;
}

/** Suivi des contrats : dossiers actifs du programme + jalons contractuels. */
export async function loadProgrammeContracts(
  programmeId: string,
  { withClientIdentity }: ClientIdentityOption,
): Promise<ProgrammeContractRow[]> {
  const where = { programmeId, archivedAt: null };
  const orderBy = { updatedAt: "desc" } as const;

  const toRow = (
    d: {
      id: string;
      contractStatus: ProgrammeContractRow["contractStatus"];
      lots: { reference: string; type: string }[];
      signatures: { status: string; signedAt: Date | null }[];
      appointments: { scheduledAt: Date }[];
    },
    clientName: string | null,
  ): ProgrammeContractRow => {
    const signed = d.signatures.find((s) => s.status === "SIGNED");
    return {
      id: d.id,
      contractStatus: d.contractStatus,
      lots: d.lots,
      signedAt: signed?.signedAt ?? null,
      hasSignature: Boolean(signed),
      nextAppointmentAt: d.appointments[0]?.scheduledAt ?? null,
      clientName,
    };
  };

  // Deux requêtes distinctes : quand l'identité est masquée, aucune donnée
  // nominative n'est extraite de la base (et pas seulement masquée à l'écran).
  if (!withClientIdentity) {
    const rows = await prisma.dossier.findMany({
      where,
      orderBy,
      select: {
        id: true,
        contractStatus: true,
        lots: { select: { reference: true, type: true } },
        signatures: { select: { status: true, signedAt: true } },
        appointments: {
          where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { scheduledAt: true },
        },
      },
    });
    return rows.map((d) => toRow(d, null));
  }

  const rows = await prisma.dossier.findMany({
    where,
    orderBy,
    select: {
      id: true,
      contractStatus: true,
      lots: { select: { reference: true, type: true } },
      signatures: { select: { status: true, signedAt: true } },
      appointments: {
        where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { scheduledAt: true },
      },
      client: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map(({ client, ...d }) =>
    toRow(d, client ? `${client.firstName} ${client.lastName}` : null),
  );
}
