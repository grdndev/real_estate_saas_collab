import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Vérifie qu'un user a le droit d'accéder à un dossier.
 *
 * Plateforme collaborative — partage total au sein du cabinet (CDC évolution §5) :
 * - SUPER_ADMIN : accès à tous les dossiers
 * - COLLABORATOR : accès à TOUS les dossiers — chaque collaboratrice voit les
 *   dossiers et documents de toute l'équipe (plateforme collaborative et partagée)
 * - NOTARY : seulement les dossiers transmis (notaryId === userId)
 * - CLIENT : seulement son propre dossier (clientId === userId)
 * - PROMOTER : pas d'accès au détail dossier (lecture agrégée de ses programmes)
 *
 * @returns le dossier si autorisé, null sinon (pas de leak d'info).
 */
export async function findDossierForUser(
  dossierId: string,
  userId: string,
  role: UserRole,
) {
  if (role === "SUPER_ADMIN" || role === "COLLABORATOR") {
    return prisma.dossier.findUnique({ where: { id: dossierId } });
  }

  if (role === "NOTARY") {
    return prisma.dossier.findFirst({
      where: { id: dossierId, notaryId: userId },
    });
  }

  if (role === "CLIENT") {
    return prisma.dossier.findFirst({
      where: { id: dossierId, clientId: userId },
    });
  }

  return null;
}

/**
 * Construit la clause `where` Prisma pour la liste de dossiers visibles par un user.
 * Collaboratrices : accès partagé à tous les dossiers du cabinet.
 */
export function dossierWhereForUser(
  userId: string,
  role: UserRole,
): Prisma.DossierWhereInput {
  if (role === "SUPER_ADMIN" || role === "COLLABORATOR") return {};
  if (role === "NOTARY") return { notaryId: userId };
  if (role === "CLIENT") return { clientId: userId };
  return { id: "__never__" };
}
