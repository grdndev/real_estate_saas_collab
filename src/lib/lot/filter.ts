import { LOT_STATUS_BADGE } from "./labels";
import type { LotStatus } from "@/generated/prisma/enums";

/**
 * Filtres de la grille des lots.
 *
 * Chaque filtre voyage dans l'URL sous la forme `?f=champ:opérateur:valeur`
 * (paramètre répétable), ce qui les conserve au rechargement et les rend
 * partageables. Le filtrage s'applique côté serveur, sur les lignes déjà
 * chargées.
 */

export const LOT_FILTER_PARAM = "f";

export type LotFilterOperator = "eq" | "neq" | "gt" | "lt";

type FieldKind = "text" | "number" | "enum";

interface FieldDef {
  label: string;
  kind: FieldKind;
  /** Options d'un champ énuméré : valeur → libellé. */
  options?: Record<string, string>;
}

export const LOT_FILTER_FIELDS = {
  reference: { label: "Référence", kind: "text" },
  surface: { label: "Surface habitable", kind: "number" },
  annexSurface: { label: "Surface annexe", kind: "number" },
  suv: { label: "Surface utile SUV", kind: "number" },
  floor: { label: "Étage", kind: "number" },
  type: { label: "Type", kind: "text" },
  priceHT: { label: "Prix HT", kind: "number" },
  vatRate: { label: "TVA", kind: "number" },
  priceTTC: { label: "Prix TTC", kind: "number" },
  status: {
    label: "Statut",
    kind: "enum",
    options: Object.fromEntries(
      Object.entries(LOT_STATUS_BADGE).map(([value, b]) => [value, b.label]),
    ),
  },
} satisfies Record<string, FieldDef>;

export type LotFilterField = keyof typeof LOT_FILTER_FIELDS;

export const LOT_FILTER_OPERATOR_LABEL: Record<LotFilterOperator, string> = {
  eq: "est",
  neq: "n'est pas",
  gt: "supérieur à",
  lt: "inférieur à",
};

export interface LotFilter {
  field: LotFilterField;
  operator: LotFilterOperator;
  value: string;
}

/** Opérateurs proposés pour un champ : comparaisons réservées aux nombres. */
export function operatorsFor(field: LotFilterField): LotFilterOperator[] {
  return LOT_FILTER_FIELDS[field].kind === "number"
    ? ["eq", "neq", "gt", "lt"]
    : ["eq", "neq"];
}

function isField(value: string): value is LotFilterField {
  return Object.hasOwn(LOT_FILTER_FIELDS, value);
}

function parseNumber(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** Sérialise un filtre pour l'URL. */
export function serializeLotFilter(filter: LotFilter): string {
  return `${filter.field}:${filter.operator}:${filter.value}`;
}

/** Lit un filtre depuis l'URL ; `null` s'il est invalide. */
export function parseLotFilter(raw: string): LotFilter | null {
  const [field, operator, ...rest] = raw.split(":");
  const value = rest.join(":");
  if (!field || !isField(field) || value === "") return null;
  if (!operatorsFor(field).includes(operator as LotFilterOperator)) {
    return null;
  }
  const def: FieldDef = LOT_FILTER_FIELDS[field];
  if (def.kind === "number" && parseNumber(value) === null) return null;
  if (def.kind === "enum" && !Object.hasOwn(def.options ?? {}, value)) {
    return null;
  }
  return { field, operator: operator as LotFilterOperator, value };
}

/** Lit tous les filtres valides d'un paramètre d'URL (simple ou répété). */
export function parseLotFilters(
  value: string | string[] | undefined,
): LotFilter[] {
  const raws = value === undefined ? [] : [value].flat();
  return raws.map(parseLotFilter).filter((f): f is LotFilter => f !== null);
}

/** Libellé lisible d'une valeur de filtre. */
export function lotFilterValueLabel(filter: LotFilter): string {
  const def: FieldDef = LOT_FILTER_FIELDS[filter.field];
  return def.options?.[filter.value] ?? filter.value;
}

/** Champs filtrables d'une ligne de lot. */
export type FilterableLot = {
  reference: string;
  surface: { toString(): string };
  annexSurface: { toString(): string } | null;
  suv: { toString(): string } | null;
  floor: number | null;
  type: string;
  priceHT: { toString(): string };
  vatRate: { toString(): string };
  priceTTC: { toString(): string };
  status: LotStatus;
};

function matches(lot: FilterableLot, filter: LotFilter): boolean {
  const raw = lot[filter.field];
  const def: FieldDef = LOT_FILTER_FIELDS[filter.field];

  if (def.kind === "number") {
    const target = parseNumber(filter.value);
    const n = raw == null ? null : Number(raw.toString());
    // Une valeur absente ne satisfait que « n'est pas ».
    if (n === null || target === null) return filter.operator === "neq";
    switch (filter.operator) {
      case "eq":
        return n === target;
      case "neq":
        return n !== target;
      case "gt":
        return n > target;
      case "lt":
        return n < target;
    }
  }

  const equal =
    String(raw ?? "").localeCompare(filter.value, "fr", {
      sensitivity: "base",
    }) === 0;
  return filter.operator === "neq" ? !equal : equal;
}

/** Garde les lots satisfaisant tous les filtres, sans muter l'entrée. */
export function applyLotFilters<T extends FilterableLot>(
  lots: readonly T[],
  filters: readonly LotFilter[],
): T[] {
  return lots.filter((lot) => filters.every((f) => matches(lot, f)));
}
