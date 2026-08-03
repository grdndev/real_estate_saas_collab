import { prisma } from "@/lib/prisma";

/**
 * Résolution des données du suivi des fonds, partagée par les espaces admin et
 * collaborateur (mêmes données : tous les programmes actifs).
 *
 * Le périmètre des données est déterminé ici — jamais dans la vue.
 */
export async function loadFondsOverview(selectedProgrammeId?: string) {
  const programmes = await prisma.programme.findMany({
    where: { status: "ACTIVE" },
    include: {
      lots: {
        include: {
          fondsSuivi: {
            include: { fondsAppeles: true },
          },
          dossier: {
            include: {
              client: { select: { firstName: true, lastName: true } },
              timelineEvents: {
                where: { kind: "ACT_SIGNED" },
                orderBy: { occurredAt: "desc" },
                take: 1,
                select: { occurredAt: true },
              },
            },
          },
        },
        orderBy: { reference: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const selectedId = selectedProgrammeId ?? programmes[0]?.id ?? null;
  const programme = programmes.find((p) => p.id === selectedId) ?? null;

  const now = new Date();
  const appelHeaders = programme
    ? (
        await prisma.appelFonds.findMany({
          where: { programmeId: programme.id },
          orderBy: { numero: "asc" },
        })
      ).map((a) => ({
        id: a.id,
        numero: a.numero,
        label: a.label,
        pourcentage: Number(a.pourcentage),
        datePrevue: a.datePrevue.toISOString(),
        debloque: a.datePrevue <= now,
      }))
    : [];

  return {
    programmes,
    programme,
    lots: programme?.lots ?? [],
    appelHeaders,
    selectedId,
    programmeOptions: programmes.map((p) => ({ id: p.id, name: p.name })),
  };
}

export type FondsOverview = Awaited<ReturnType<typeof loadFondsOverview>>;

/** Détail d'un lot pour la fiche « suivi des fonds ». */
export async function loadLotFondsDetail(lotId: string) {
  return prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      programme: { select: { name: true } },
      dossier: {
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneEnc: true,
              addressEnc: true,
              additionalEmailsEnc: true,
            },
          },
          timelineEvents: {
            where: { kind: "ACT_SIGNED" },
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { occurredAt: true },
          },
          prospect: { select: { id: true } },
          signatures: {
            where: { status: { in: ["CREATED", "SENT", "OPENED"] } },
            take: 1,
            select: { id: true },
          },
        },
      },
      fondsSuivi: {
        include: { fondsAppeles: true },
      },
    },
  });
}

export type LotFondsDetail = NonNullable<
  Awaited<ReturnType<typeof loadLotFondsDetail>>
>;
