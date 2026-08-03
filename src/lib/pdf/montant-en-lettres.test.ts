import { describe, expect, it } from "vitest";

import { montantEnLettres, nombreEnLettres } from "./montant-en-lettres";

describe("nombreEnLettres", () => {
  it("écrit les cas de base", () => {
    expect(nombreEnLettres(0)).toBe("zéro");
    expect(nombreEnLettres(1)).toBe("un");
    expect(nombreEnLettres(16)).toBe("seize");
    expect(nombreEnLettres(17)).toBe("dix-sept");
  });

  it("applique la règle « et un »", () => {
    expect(nombreEnLettres(21)).toBe("vingt et un");
    expect(nombreEnLettres(31)).toBe("trente et un");
    expect(nombreEnLettres(61)).toBe("soixante et un");
    expect(nombreEnLettres(71)).toBe("soixante et onze");
    // Pas de « et » après quatre-vingt.
    expect(nombreEnLettres(81)).toBe("quatre-vingt-un");
    expect(nombreEnLettres(91)).toBe("quatre-vingt-onze");
  });

  it("gère les 70 et 90 construits sur 60 et 80", () => {
    expect(nombreEnLettres(70)).toBe("soixante-dix");
    expect(nombreEnLettres(77)).toBe("soixante-dix-sept");
    expect(nombreEnLettres(90)).toBe("quatre-vingt-dix");
    expect(nombreEnLettres(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("accorde quatre-vingts", () => {
    expect(nombreEnLettres(80)).toBe("quatre-vingts");
    expect(nombreEnLettres(80_000)).toBe("quatre-vingt mille"); // pas de « s » devant mille
    expect(nombreEnLettres(180)).toBe("cent quatre-vingts");
  });

  it("accorde cent", () => {
    expect(nombreEnLettres(100)).toBe("cent");
    expect(nombreEnLettres(200)).toBe("deux cents");
    expect(nombreEnLettres(201)).toBe("deux cent un");
    expect(nombreEnLettres(200_000)).toBe("deux cent mille"); // pas de « s » devant mille
  });

  it("laisse mille invariable", () => {
    expect(nombreEnLettres(1_000)).toBe("mille");
    expect(nombreEnLettres(2_000)).toBe("deux mille");
    expect(nombreEnLettres(1_971)).toBe("mille neuf cent soixante et onze");
  });

  it("accorde million et milliard", () => {
    expect(nombreEnLettres(1_000_000)).toBe("un million");
    expect(nombreEnLettres(2_000_000)).toBe("deux millions");
    expect(nombreEnLettres(1_234_567)).toBe(
      "un million deux cent trente-quatre mille cinq cent soixante-sept",
    );
  });
});

// `montantEnLettres` met le résultat en capitales : convention des actes et
// factures d'honoraires, où le montant en lettres est écrit en majuscules.
describe("montantEnLettres", () => {
  it("écrit les montants entiers", () => {
    expect(montantEnLettres(0)).toBe("ZÉRO EURO");
    expect(montantEnLettres(1)).toBe("UN EURO");
    expect(montantEnLettres(21)).toBe("VINGT ET UN EUROS");
    expect(montantEnLettres(80)).toBe("QUATRE-VINGTS EUROS");
    expect(montantEnLettres(100)).toBe("CENT EUROS");
    expect(montantEnLettres(200)).toBe("DEUX CENTS EUROS");
    expect(montantEnLettres(1_000)).toBe("MILLE EUROS");
    expect(montantEnLettres(80_000)).toBe("QUATRE-VINGT MILLE EUROS");
    expect(montantEnLettres(200_000)).toBe("DEUX CENT MILLE EUROS");
  });

  it("écrit les centimes", () => {
    expect(montantEnLettres(14_250.5)).toBe(
      "QUATORZE MILLE DEUX CENT CINQUANTE EUROS ET CINQUANTE CENTIMES",
    );
    expect(montantEnLettres(0.01)).toBe("ZÉRO EURO ET UN CENTIME");
    expect(montantEnLettres(1.05)).toBe("UN EURO ET CINQ CENTIMES");
    expect(montantEnLettres(19.99)).toBe(
      "DIX-NEUF EUROS ET QUATRE-VINGT-DIX-NEUF CENTIMES",
    );
  });

  it("arrondit proprement les flottants", () => {
    // 19.90 est représenté 19.900000000000002 en flottant.
    expect(montantEnLettres(19.9)).toBe(
      "DIX-NEUF EUROS ET QUATRE-VINGT-DIX CENTIMES",
    );
  });

  it("utilise « d'euros » après million", () => {
    expect(montantEnLettres(1_000_000)).toBe("UN MILLION D'EUROS");
    expect(montantEnLettres(2_000_000)).toBe("DEUX MILLIONS D'EUROS");
  });

  it("rejette les montants négatifs", () => {
    expect(() => montantEnLettres(-1)).toThrow();
  });
});
