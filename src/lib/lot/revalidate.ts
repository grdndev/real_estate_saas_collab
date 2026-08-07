import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

/**
 * Revalidation des écrans internes.
 *
 * Depuis le passage à un modèle centré sur le lot, la clé d'URL des espaces
 * collaborateur et admin est le LOT (`/…/lots/<lotId>`), pas le dossier : c'est
 * lui qu'il faut revalider après toute mutation du dossier qu'il porte.
 *
 * Ce module n'est volontairement PAS `"use server"` : il exporte des helpers
 * synchrones utilisés depuis les modules de server actions.
 */

/** Liste des lots + fiche d'un lot, dans les deux espaces internes. */
export function revalidateLotPaths(lotId: string, suffix = ""): void {
  revalidatePath("/collaborateur/lots");
  revalidatePath("/admin/lots");
  revalidatePath(`/collaborateur/lots/${lotId}${suffix}`);
  revalidatePath(`/admin/lots/${lotId}${suffix}`);
}

/** Idem, quand seul l'identifiant du dossier est connu. */
export async function revalidateDossierPaths(
  dossierId: string,
  suffix = "",
): Promise<void> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { lotId: true },
  });
  if (dossier) revalidateLotPaths(dossier.lotId, suffix);
}

/** Chemin de la fiche lot côté collaborateur — cible des notifications. */
export function collaboratorLotPath(lotId: string, suffix = ""): string {
  return `/collaborateur/lots/${lotId}${suffix}`;
}
