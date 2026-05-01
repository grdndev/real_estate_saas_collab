import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/enums";

/** Liste des id programmes accessibles par un promoteur. */
export async function programmesForPromoter(userId: string): Promise<string[]> {
  const links = await prisma.programmePromoter.findMany({
    where: { promoterId: userId },
    select: { programmeId: true },
  });
  return links.map((l) => l.programmeId);
}

export async function findProgrammeForRole(
  programmeId: string,
  userId: string,
  role: UserRole,
) {
  if (role === "SUPER_ADMIN") {
    return prisma.programme.findUnique({ where: { id: programmeId } });
  }
  if (role === "PROMOTER") {
    const link = await prisma.programmePromoter.findUnique({
      where: {
        programmeId_promoterId: { programmeId, promoterId: userId },
      },
    });
    if (!link) return null;
    return prisma.programme.findUnique({ where: { id: programmeId } });
  }
  return null;
}
