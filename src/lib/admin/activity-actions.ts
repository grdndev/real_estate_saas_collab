"use server";

import { requireRole } from "@/lib/auth/guards";
import { loadActivityPage, type ActivityPage } from "@/lib/admin/activity";
import {
  activityFiltersFrom,
  parseActivityQuery,
} from "@/lib/admin/activity-params";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Tranche suivante du journal d'activité (T16 — scroll infini).
 *
 * Le périmètre est relu depuis la query string de la page, avec le même
 * analyseur que la route. Le rôle est revérifié : le journal reste réservé à
 * l'administration, quel que soit le curseur présenté.
 */
export async function loadMoreActivityAction(
  query: string,
  cursor: string | null,
): Promise<ActionResult<ActivityPage>> {
  await requireRole("SUPER_ADMIN");

  const params = new URLSearchParams(query);
  const parsed = parseActivityQuery((key) => params.get(key));
  const page = await loadActivityPage(
    parsed.vue,
    parsed.id,
    activityFiltersFrom(parsed),
    cursor,
  );
  return { ok: true, value: page };
}
