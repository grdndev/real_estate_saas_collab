import { describe, expect, it } from "vitest";

import {
  compareLotReferences,
  parseSortDirection,
  sortByLotReference,
  toggleSortDirection,
} from "./sort";

/**
 * T13 : les références de lot se trient naturellement — « Lot 2 » précède
 * « Lot 10 », ce que le tri lexicographique ne fait pas.
 */
describe("compareLotReferences", () => {
  it("place « Lot 2 » avant « Lot 10 »", () => {
    expect(compareLotReferences("Lot 2", "Lot 10")).toBeLessThan(0);
    expect(compareLotReferences("Lot 10", "Lot 2")).toBeGreaterThan(0);
  });

  it("trie les références collées à leur numéro", () => {
    expect(compareLotReferences("A2", "A10")).toBeLessThan(0);
    expect(compareLotReferences("A9", "A100")).toBeLessThan(0);
  });

  it("ignore la casse et les accents", () => {
    expect(compareLotReferences("lot 3", "LOT 3")).toBe(0);
    expect(compareLotReferences("Étage 2", "Etage 2")).toBe(0);
  });

  it("classe les préfixes de lettres avant les numéros", () => {
    expect(compareLotReferences("A10", "B2")).toBeLessThan(0);
  });
});

describe("sortByLotReference", () => {
  const refs = (values: (string | null)[]) =>
    values.map((reference) => ({ reference }));

  it("trie en ordre naturel croissant", () => {
    const sorted = sortByLotReference(
      refs(["Lot 10", "Lot 2", "Lot 1", "Lot 21", "Lot 3"]),
      (r) => r.reference,
    );
    expect(sorted.map((r) => r.reference)).toEqual([
      "Lot 1",
      "Lot 2",
      "Lot 3",
      "Lot 10",
      "Lot 21",
    ]);
  });

  it("trie en ordre naturel décroissant", () => {
    const sorted = sortByLotReference(
      refs(["Lot 2", "Lot 10", "Lot 1"]),
      (r) => r.reference,
      "desc",
    );
    expect(sorted.map((r) => r.reference)).toEqual([
      "Lot 10",
      "Lot 2",
      "Lot 1",
    ]);
  });

  it("renvoie les références absentes en fin de liste dans les deux sens", () => {
    const asc = sortByLotReference(
      refs(["Lot 2", null, "Lot 1"]),
      (r) => r.reference,
      "asc",
    );
    expect(asc.map((r) => r.reference)).toEqual(["Lot 1", "Lot 2", null]);

    const desc = sortByLotReference(
      refs(["Lot 2", null, "Lot 1"]),
      (r) => r.reference,
      "desc",
    );
    expect(desc.map((r) => r.reference)).toEqual(["Lot 2", "Lot 1", null]);
  });

  it("ne mute pas la liste d'entrée", () => {
    const input = refs(["Lot 10", "Lot 2"]);
    sortByLotReference(input, (r) => r.reference);
    expect(input.map((r) => r.reference)).toEqual(["Lot 10", "Lot 2"]);
  });

  it("diffère du tri lexicographique — c'est bien le bug corrigé", () => {
    const lexicographic = ["Lot 10", "Lot 2"].sort((a, b) =>
      a.localeCompare(b),
    );
    expect(lexicographic).toEqual(["Lot 10", "Lot 2"]);

    const natural = sortByLotReference(
      refs(["Lot 10", "Lot 2"]),
      (r) => r.reference,
    ).map((r) => r.reference);
    expect(natural).toEqual(["Lot 2", "Lot 10"]);
  });
});

describe("toggleSortDirection / parseSortDirection", () => {
  it("inverse le sens de tri", () => {
    expect(toggleSortDirection("asc")).toBe("desc");
    expect(toggleSortDirection("desc")).toBe("asc");
  });

  it("lit le sens depuis l'URL, croissant par défaut", () => {
    expect(parseSortDirection("desc")).toBe("desc");
    expect(parseSortDirection("asc")).toBe("asc");
    expect(parseSortDirection(undefined)).toBe("asc");
    expect(parseSortDirection("n'importe quoi")).toBe("asc");
  });
});
