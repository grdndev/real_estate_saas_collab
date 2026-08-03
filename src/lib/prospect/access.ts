import { prisma } from "@/lib/prisma";
import { dossierHasActivity } from "@/lib/prospect/dossier-activity";
import type { ProspectRow } from "@/components/prospects/prospects-table";

/**
 * Résolution des données de la vue « prospects », partagée par les espaces
 * collaborateur, admin et promoteur (T15).
 *
 * `programmeIds = null` signifie « tous les programmes » (équipe interne) ;
 * une liste restreint le périmètre (promoteur). Le périmètre est décidé par la
 * route appelante, jamais dans la vue.
 */
export interface ProspectScope {
  programmeIds: string[] | null;
}

export async function loadProspects({
  programmeIds,
}: ProspectScope): Promise<ProspectRow[]> {
  const prospects = await prisma.prospect.findMany({
    where: programmeIds !== null ? { programmeId: { in: programmeIds } } : {},
    // Le plus récent d'abord ; `id` départage les créations à la même
    // milliseconde et garantit un curseur stable (T2).
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      programme: { select: { name: true } },
      convertedDossier: {
        select: {
          id: true,
          timelineEvents: { select: { kind: true } },
          _count: {
            select: {
              documents: true,
              signatures: true,
              messages: true,
              invoices: true,
            },
          },
        },
      },
      sharedNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return prospects.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    city: p.city,
    phone: p.phone,
    programmeId: p.programmeId,
    programmeName: p.programme?.name ?? null,
    source: p.source,
    status: p.status,
    convertedDossierId: p.convertedDossier?.id ?? null,
    dossierHasActivity: dossierHasActivity(p.convertedDossier),
    createdAt: p.createdAt,
    notes: p.sharedNotes.map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.authorId,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      createdAt: n.createdAt.toISOString(),
    })),
  }));
}

/** Programmes proposés dans les formulaires de création / conversion. */
export async function loadProspectProgrammes({ programmeIds }: ProspectScope) {
  return prisma.programme.findMany({
    where:
      programmeIds !== null
        ? { id: { in: programmeIds } }
        : { status: "ACTIVE" },
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
  });
}

export type ProspectProgramme = Awaited<
  ReturnType<typeof loadProspectProgrammes>
>[number];
