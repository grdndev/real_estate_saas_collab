import { describe, expect, it } from "vitest";

import { buildProspectCreateData } from "./create-data";

const baseInput = {
  firstName: "Marie",
  lastName: "Payet",
  email: "marie.payet@example.re",
};

const collaborator = { id: "collab-1", role: "COLLABORATOR" as const };
const promoter = { id: "promo-1", role: "PROMOTER" as const };

describe("buildProspectCreateData", () => {
  it("enregistre la note de création comme note partagée de son auteur", () => {
    const data = buildProspectCreateData(
      { ...baseInput, notes: "  Rappeler lundi  " },
      collaborator,
    );

    expect(data.sharedNotes).toEqual({
      create: {
        scope: "PROSPECT",
        authorId: "collab-1",
        body: "Rappeler lundi",
      },
    });
    expect(data).not.toHaveProperty("notes");
  });

  it("ne crée aucune note quand le champ est vide ou blanc", () => {
    expect(
      buildProspectCreateData(baseInput, collaborator).sharedNotes,
    ).toBeUndefined();
    expect(
      buildProspectCreateData({ ...baseInput, notes: "   " }, collaborator)
        .sharedNotes,
    ).toBeUndefined();
  });

  it("conserve le téléphone saisi", () => {
    const data = buildProspectCreateData(
      { ...baseInput, phone: "0692 12 34 56" },
      collaborator,
    );

    expect(data.phone).toBe("0692 12 34 56");
  });

  it("n'attribue le prospect qu'à un collaborateur", () => {
    expect(buildProspectCreateData(baseInput, collaborator).ownerId).toBe(
      "collab-1",
    );
    expect(buildProspectCreateData(baseInput, promoter).ownerId).toBeNull();
  });
});
