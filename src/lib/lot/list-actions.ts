"use server";

import { requireRole } from "@/lib/auth/guards";
import { loadLotPage, type LotPage } from "@/lib/lot/list-access";
import { lotFiltersSchema } from "@/lib/lot/schemas";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Tranche suivante de la liste des lots (T16 — scroll infini).
 *
 * Les filtres transitent sous leur forme d'origine — la query string de la
 * page — et non sous leur forme déjà analysée : `lotFiltersSchema` applique
 * des transformations (`associes`, `tri`), sa sortie n'est donc pas une entrée
 * valide pour lui-même. Le rôle est relu depuis la session : un curseur ne
 * peut pas servir à élargir le périmètre de lecture.
 */
export async function loadMoreLotsAction(
  query: string,
  cursor: string | null,
): Promise<ActionResult<LotPage>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = lotFiltersSchema.safeParse(
    Object.fromEntries(new URLSearchParams(query)),
  );
  if (!parsed.success) return { ok: false, error: "Filtres invalides" };

  const page = await loadLotPage(me.role, parsed.data, cursor);
  return { ok: true, value: page };
}
