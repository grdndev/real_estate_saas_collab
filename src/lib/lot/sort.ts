/**
 * Tri des références de lot (T13).
 *
 * Les références mêlent lettres et nombres (« Lot 2 », « Lot 10 », « A101 »).
 * Un tri lexicographique — celui de `localeCompare` sans option et celui de
 * `orderBy: { reference: "asc" }` côté Postgres — place « Lot 10 » avant
 * « Lot 2 ». Le collateur numérique compare les suites de chiffres comme des
 * nombres, ce qui donne l'ordre attendu.
 */

/** Collateur français, insensible à la casse et aux accents, numérique. */
const REFERENCE_COLLATOR = new Intl.Collator("fr", {
  numeric: true,
  sensitivity: "base",
});

export type LotSortDirection = "asc" | "desc";

/** Compare deux références de lot en tri naturel. */
export function compareLotReferences(a: string, b: string): number {
  return REFERENCE_COLLATOR.compare(a, b);
}

/**
 * Trie une liste d'objets portant une référence de lot, sans muter l'entrée.
 * Les valeurs absentes sont renvoyées en fin de liste dans les deux sens.
 */
export function sortByLotReference<T>(
  items: readonly T[],
  getReference: (item: T) => string | null | undefined,
  direction: LotSortDirection = "asc",
): T[] {
  const factor = direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const refA = getReference(a);
    const refB = getReference(b);
    if (!refA && !refB) return 0;
    // Les lots sans référence restent en fin de liste, quel que soit le sens.
    if (!refA) return 1;
    if (!refB) return -1;
    return factor * compareLotReferences(refA, refB);
  });
}

/** Sens de tri opposé — pour les en-têtes de colonne cliquables. */
export function toggleSortDirection(
  direction: LotSortDirection,
): LotSortDirection {
  return direction === "asc" ? "desc" : "asc";
}

/** Lit un sens de tri depuis un paramètre d'URL, `asc` par défaut. */
export function parseSortDirection(value?: string | null): LotSortDirection {
  return value === "desc" ? "desc" : "asc";
}
