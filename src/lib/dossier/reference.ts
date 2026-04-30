import { prisma } from "@/lib/prisma";

/**
 * Génère une référence dossier unique au format "EQ-YYYY-NNNN".
 * Tente jusqu'à 5 fois en cas de collision (race rare mais possible).
 *
 * Pour un volume > 1000 dossiers/an, remplacer par une séquence Postgres dédiée.
 */
export async function generateDossierReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EQ-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.dossier.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    });

    let nextNumber = 1;
    if (last) {
      const match = last.reference.match(/(\d+)$/);
      if (match?.[1]) {
        nextNumber = parseInt(match[1], 10) + 1 + attempt;
      }
    } else {
      nextNumber = 1 + attempt;
    }

    const candidate = `${prefix}${String(nextNumber).padStart(4, "0")}`;
    const exists = await prisma.dossier.findUnique({
      where: { reference: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error(
    "Impossible de générer une référence unique après 5 tentatives.",
  );
}
