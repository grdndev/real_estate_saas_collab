import type { ActivityFilters, ActivityVue } from "@/lib/admin/activity";

/**
 * Lecture des paramètres de la page Activité, partagée par la route (première
 * tranche) et par l'action serveur (tranches suivantes) — T16.
 *
 * Les deux doivent interpréter l'URL exactement de la même façon : sinon le
 * curseur avancerait dans un périmètre différent de celui affiché.
 */

const VUES: ActivityVue[] = ["tout", "utilisateur", "programme", "dossier"];

export interface ActivityQuery {
  vue: ActivityVue;
  id: string;
  action: string;
  du: string;
  au: string;
}

/** Borne une date de filtre ; `undefined` si le format n'est pas `AAAA-MM-JJ`. */
function parseDate(value: string, endOfDay: boolean): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseActivityQuery(
  get: (key: string) => string | null | undefined,
): ActivityQuery {
  const raw = (key: string) => get(key) ?? "";
  const vue = raw("vue");
  return {
    vue: (VUES as string[]).includes(vue) ? (vue as ActivityVue) : "tout",
    id: raw("id"),
    action: raw("action"),
    du: raw("du"),
    au: raw("au"),
  };
}

export function activityFiltersFrom(query: ActivityQuery): ActivityFilters {
  return {
    action: query.action || undefined,
    from: query.du ? parseDate(query.du, false) : undefined,
    to: query.au ? parseDate(query.au, true) : undefined,
  };
}

/** Paramètres à conserver dans les liens de la page (tout sauf le curseur). */
export function activityBaseParams(query: ActivityQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.vue !== "tout") {
    params.set("vue", query.vue);
    if (query.id) params.set("id", query.id);
  }
  if (query.action) params.set("action", query.action);
  if (query.du) params.set("du", query.du);
  if (query.au) params.set("au", query.au);
  return params;
}
