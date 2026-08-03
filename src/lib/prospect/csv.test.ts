import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

/**
 * T2 : l'import CSV de prospects ne retient que nom, prénom, téléphone et
 * email. Toute autre colonne du fichier — notamment la commune — est ignorée.
 */
describe("parseCsv — import de prospects", () => {
  it("lit les quatre champs retenus", () => {
    const rows = parseCsv(
      [
        "Prénom,Nom,Email,Téléphone",
        "Jean,Dupont,Jean.Dupont@Example.Test,0692112233",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean.dupont@example.test",
        phone: "0692112233",
      },
    ]);
  });

  it("ignore la colonne Commune du fichier", () => {
    const rows = parseCsv(
      [
        "Prénom,Nom,Email,Commune,Téléphone",
        "Marie,Martin,marie@example.test,Saint-Denis,0692445566",
      ].join("\n"),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("city");
    expect(rows[0]).toEqual({
      firstName: "Marie",
      lastName: "Martin",
      email: "marie@example.test",
      phone: "0692445566",
    });
  });

  it("accepte le point-virgule comme séparateur", () => {
    const rows = parseCsv(
      ["Nom;Prénom;Email", "Martin;Marie;marie@example.test"].join("\n"),
    );

    expect(rows[0]?.firstName).toBe("Marie");
    expect(rows[0]?.lastName).toBe("Martin");
  });

  it("accepte les variantes d'en-têtes usuelles", () => {
    const rows = parseCsv(
      [
        "first name,last name,adresse e-mail,mobile",
        "Léa,Bernard,lea@example.test,0692778899",
      ].join("\n"),
    );

    expect(rows[0]).toEqual({
      firstName: "Léa",
      lastName: "Bernard",
      email: "lea@example.test",
      phone: "0692778899",
    });
  });

  it("laisse le téléphone indéfini quand la colonne est absente", () => {
    const rows = parseCsv(
      ["Prénom,Nom,Email", "Paul,Petit,paul@example.test"].join("\n"),
    );

    expect(rows[0]?.phone).toBeUndefined();
  });

  it("ignore les lignes sans nom, prénom ou email", () => {
    const rows = parseCsv(
      [
        "Prénom,Nom,Email",
        "Jean,Dupont,jean@example.test",
        ",Martin,marie@example.test",
        "Léa,,lea@example.test",
        "Paul,Petit,",
      ].join("\n"),
    );

    expect(rows.map((r) => r.email)).toEqual(["jean@example.test"]);
  });

  it("retourne une liste vide si les en-têtes obligatoires manquent", () => {
    expect(
      parseCsv(["Commune,Téléphone", "Saint-Denis,0692"].join("\n")),
    ).toEqual([]);
  });

  it("retourne une liste vide sur une entrée vide", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("supporte les guillemets et les fins de ligne Windows", () => {
    const rows = parseCsv(
      ['"Prénom","Nom","Email"\r\n"Jean","Dupont","jean@example.test"'].join(
        "",
      ),
    );

    expect(rows[0]?.firstName).toBe("Jean");
    expect(rows[0]?.email).toBe("jean@example.test");
  });
});
