import { describe, expect, it } from "vitest";

import { applyLotFilters, parseLotFilter, parseLotFilters } from "./filter";

const lot = (over: Partial<Parameters<typeof applyLotFilters>[0][number]>) => ({
  reference: "A101",
  surface: 45,
  annexSurface: null,
  suv: null,
  floor: 1,
  type: "T2",
  priceHT: 170_000,
  vatRate: 5.5,
  priceTTC: 179_350,
  status: "AVAILABLE" as const,
  ...over,
});

describe("parseLotFilter", () => {
  it("lit un filtre valide", () => {
    expect(parseLotFilter("surface:gt:50")).toEqual({
      field: "surface",
      operator: "gt",
      value: "50",
    });
  });

  it("conserve les « : » de la valeur", () => {
    expect(parseLotFilter("reference:eq:A:1")?.value).toBe("A:1");
  });

  it("rejette champ, opérateur ou valeur invalides", () => {
    expect(parseLotFilter("inconnu:eq:1")).toBeNull();
    expect(parseLotFilter("type:gt:T2")).toBeNull();
    expect(parseLotFilter("surface:eq:abc")).toBeNull();
    expect(parseLotFilter("status:eq:FOO")).toBeNull();
    expect(parseLotFilter("type:eq:")).toBeNull();
  });

  it("ignore les filtres invalides d'une liste", () => {
    expect(parseLotFilters(["floor:lt:2", "bad"])).toHaveLength(1);
    expect(parseLotFilters(undefined)).toEqual([]);
  });
});

describe("applyLotFilters", () => {
  const lots = [
    lot({ reference: "A101", surface: 45, status: "SOLD" }),
    lot({ reference: "A102", surface: 64, type: "T3", suv: 60 }),
    lot({ reference: "A201", surface: 82, type: "T4" }),
  ];
  const refs = (filters: string[]) =>
    applyLotFilters(lots, parseLotFilters(filters)).map((l) => l.reference);

  it("compare les nombres", () => {
    expect(refs(["surface:gt:50"])).toEqual(["A102", "A201"]);
    expect(refs(["surface:lt:64"])).toEqual(["A101"]);
    expect(refs(["surface:eq:64,0"])).toEqual(["A102"]);
  });

  it("compare le texte sans tenir compte de la casse", () => {
    expect(refs(["type:eq:t3"])).toEqual(["A102"]);
    expect(refs(["type:neq:T3"])).toEqual(["A101", "A201"]);
  });

  it("filtre sur le statut", () => {
    expect(refs(["status:neq:SOLD"])).toEqual(["A102", "A201"]);
  });

  it("une valeur absente ne satisfait que « n'est pas »", () => {
    expect(refs(["suv:gt:0"])).toEqual(["A102"]);
    expect(refs(["suv:neq:60"])).toEqual(["A101", "A201"]);
  });

  it("combine les filtres (ET)", () => {
    expect(refs(["surface:gt:50", "type:neq:T4"])).toEqual(["A102"]);
  });
});
