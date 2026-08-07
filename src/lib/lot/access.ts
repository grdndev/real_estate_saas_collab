import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Vérifie qu'un user a le droit de consulter un lot.
 *
 * Un lot est une donnée du cabinet, indépendante du dossier : il reste
 * consultable qu'il porte un client ou non.
 *
 * - SUPER_ADMIN / COLLABORATOR : accès à tous les lots (plateforme partagée)
 * - autres rôles : aucun accès à la fiche lot interne (le client passe par son
 *   dossier, le promoteur par la grille de son programme)
 *
 * @returns le lot si autorisé, null sinon (pas de leak d'info).
 */
export async function findLotForUser(lotId: string, role: UserRole) {
  if (role !== "SUPER_ADMIN" && role !== "COLLABORATOR") return null;
  return prisma.lot.findUnique({ where: { id: lotId } });
}

/**
 * Dossier ACTIF d'un lot — celui vers lequel `Lot.dossierId` pointe.
 *
 * Les autres dossiers du lot sont son historique : ils gardent leur `lotId`
 * mais ne sont plus référencés par le lot (cf. `loadLotDossierHistory`).
 */
export async function findActiveDossierForLot(lotId: string, role: UserRole) {
  const lot = await findLotForUser(lotId, role);
  if (!lot?.dossierId) return null;
  return prisma.dossier.findUnique({ where: { id: lot.dossierId } });
}

/** Dossiers archivés d'un lot : clients précédents, en lecture seule (T10). */
export async function loadLotDossierHistory(lotId: string) {
  return prisma.dossier.findMany({
    where: { lotId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    select: {
      id: true,
      archivedAt: true,
      status: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { messages: true, documents: true } },
    },
  });
}
