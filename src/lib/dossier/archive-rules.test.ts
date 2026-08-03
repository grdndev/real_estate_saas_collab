import { describe, expect, it } from "vitest";

import {
  isDossierEmpty,
  planClientAssignment,
  type DossierContentCounts,
} from "./archive-rules";

const EMPTY: DossierContentCounts = {
  messages: 0,
  documents: 0,
  timelineEvents: 1, // événement « Dossier créé », toujours présent
  invoices: 0,
  signatures: 0,
  appointments: 0,
  notes: 0,
};

describe("isDossierEmpty", () => {
  it("considère vide un dossier ne portant que sa création", () => {
    expect(isDossierEmpty(EMPTY)).toBe(true);
  });

  it("ignore le nombre d'événements de timeline", () => {
    expect(isDossierEmpty({ ...EMPTY, timelineEvents: 12 })).toBe(true);
  });

  it.each([
    ["messages", { messages: 1 }],
    ["documents", { documents: 1 }],
    ["factures", { invoices: 1 }],
    ["signatures", { signatures: 1 }],
    ["rendez-vous", { appointments: 1 }],
    ["notes", { notes: 1 }],
  ])("considère non vide un dossier portant des %s", (_label, overrides) => {
    expect(isDossierEmpty({ ...EMPTY, ...overrides })).toBe(false);
  });
});

describe("planClientAssignment", () => {
  it("rattache simplement le client quand il n'a pas d'historique sur le lot", () => {
    expect(
      planClientAssignment({
        archivedDossierId: null,
        currentCounts: EMPTY,
      }),
    ).toEqual({ kind: "attach" });
  });

  it("réactive le dossier archivé et supprime le dossier support vide", () => {
    expect(
      planClientAssignment({
        archivedDossierId: "dossier-1",
        currentCounts: EMPTY,
      }),
    ).toEqual({
      kind: "reactivate",
      archivedDossierId: "dossier-1",
      currentDossierDisposal: "delete",
    });
  });

  it("réactive le dossier archivé et archive le dossier support non vide", () => {
    expect(
      planClientAssignment({
        archivedDossierId: "dossier-1",
        currentCounts: { ...EMPTY, messages: 3 },
      }),
    ).toEqual({
      kind: "reactivate",
      archivedDossierId: "dossier-1",
      currentDossierDisposal: "archive",
    });
  });

  it("ne réactive jamais un dossier quand aucun historique n'est trouvé, même si le dossier courant porte des données", () => {
    expect(
      planClientAssignment({
        archivedDossierId: null,
        currentCounts: { ...EMPTY, messages: 5, documents: 2 },
      }),
    ).toEqual({ kind: "attach" });
  });
});
