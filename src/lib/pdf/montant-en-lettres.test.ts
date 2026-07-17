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

describe("montantEnLettres", () => {
  it("écrit les montants entiers", () => {
    expect(montantEnLettres(0)).toBe("zéro euro");
    expect(montantEnLettres(1)).toBe("un euro");
    expect(montantEnLettres(21)).toBe("vingt et un euros");
    expect(montantEnLettres(80)).toBe("quatre-vingts euros");
    expect(montantEnLettres(100)).toBe("cent euros");
    expect(montantEnLettres(200)).toBe("deux cents euros");
    expect(montantEnLettres(1_000)).toBe("mille euros");
    expect(montantEnLettres(80_000)).toBe("quatre-vingt mille euros");
    expect(montantEnLettres(200_000)).toBe("deux cent mille euros");
  });

  it("écrit les centimes", () => {
    expect(montantEnLettres(14_250.5)).toBe(
      "quatorze mille deux cent cinquante euros et cinquante centimes",
    );
    expect(montantEnLettres(0.01)).toBe("zéro euro et un centime");
    expect(montantEnLettres(1.05)).toBe("un euro et cinq centimes");
    expect(montantEnLettres(19.99)).toBe(
      "dix-neuf euros et quatre-vingt-dix-neuf centimes",
    );
  });

  it("arrondit proprement les flottants", () => {
    // 19.90 est représenté 19.900000000000002 en flottant.
    expect(montantEnLettres(19.9)).toBe(
      "dix-neuf euros et quatre-vingt-dix centimes",
    );
  });

  it("utilise « d'euros » après million", () => {
    expect(montantEnLettres(1_000_000)).toBe("un million d'euros");
    expect(montantEnLettres(2_000_000)).toBe("deux millions d'euros");
  });

  it("rejette les montants négatifs", () => {
    expect(() => montantEnLettres(-1)).toThrow();
  });
});
