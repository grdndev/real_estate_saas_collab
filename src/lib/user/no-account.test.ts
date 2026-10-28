import { describe, expect, it } from "vitest";

import { isPlaceholderEmail, resolveClientEmail } from "./no-account";

const placeholder = "client-123@sans-compte.equatis.invalid";

describe("resolveClientEmail", () => {
  it("retient l'adresse saisie", () => {
    expect(
      resolveClientEmail("nouveau@example.re", {
        email: "ancien@example.re",
        status: "ACTIVE",
      }),
    ).toBe("nouveau@example.re");
  });

  it("exige une adresse pour un client disposant d'un compte", () => {
    expect(
      resolveClientEmail("", { email: "ancien@example.re", status: "ACTIVE" }),
    ).toBeNull();
  });

  it("conserve l'adresse technique d'un client sans compte", () => {
    expect(
      resolveClientEmail("", { email: placeholder, status: "NO_ACCOUNT" }),
    ).toBe(placeholder);
  });

  it("attribue une adresse technique quand l'email d'un client sans compte est effacé", () => {
    const email = resolveClientEmail(undefined, {
      email: "ancien@example.re",
      status: "NO_ACCOUNT",
    });
    expect(isPlaceholderEmail(email)).toBe(true);
  });
});
