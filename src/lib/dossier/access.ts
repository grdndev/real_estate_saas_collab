import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Vérifie qu'un user a le droit d'accéder à un dossier (CDC §2.2 cloisonnement).
 *
 * Règles :
 * - SUPER_ADMIN : accès à tous les dossiers
 * - COLLABORATOR : seulement les dossiers dont il est participant
 * - NOTARY : seulement les dossiers transmis (notaryId === userId)
 * - CLIENT : seulement son propre dossier (clientId === userId)
 * - PROMOTER : pas d'accès aux dossiers (lecture limitée à ses programmes — voir Phase 3)
 *
 * @returns le dossier si autorisé, null sinon (pas de leak d'info).
 */
export async function findDossierForUser(
  dossierId: string,
  userId: string,
  role: UserRole,
) {
  if (role === "SUPER_ADMIN") {
    return prisma.dossier.findUnique({ where: { id: dossierId } });
  }

  if (role === "COLLABORATOR") {
    const link = await prisma.dossierParticipant.findFirst({
      where: {
        dossierId,
        userId,
        role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
      },
      select: { dossierId: true },
    });
    if (!link) return null;
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
 * Utilisée pour la liste paginée de dossiers côté collaborateur, notaire ou client.
 */
export function dossierWhereForUser(
  userId: string,
  role: UserRole,
): Prisma.DossierWhereInput {
  if (role === "SUPER_ADMIN") return {};
  if (role === "COLLABORATOR") {
    return {
      participants: {
        some: {
          userId,
          role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
        },
      },
    };
  }
  if (role === "NOTARY") return { notaryId: userId };
  if (role === "CLIENT") return { clientId: userId };
  return { id: "__never__" };
}
