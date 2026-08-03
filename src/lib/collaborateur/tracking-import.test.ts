import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseTrackingWorkbook } from "./tracking-import";

/**
 * Régression T8 (bug « 65 lots importés sur 99 ») : toute ligne du fichier de
 * suivi possédant une référence doit être conservée, même si la surface ou le
 * prix FAI est absent — la ligne est alors signalée pour correction.
 */

// En-têtes reconnus par les alias de `tracking-import.ts`.
const HEADERS = [
  "Localisation",
  "Lot",
  "Étage",
  "Type",
  "Surface habitable",
  "Prix FAI",
  "TVA",
  "Nom acquéreur",
  "Mail",
];

type Row = (string | number | null)[];

async function parse(rows: Row[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Suivi");
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return parseTrackingWorkbook(Buffer.from(buf as ArrayBuffer));
}

/** Ligne complète de référence. */
const complete = (ref: string): Row => [
  "Bât. A",
  ref,
  "1",
  "T2",
  45,
  180000,
  8.5,
  "Dupont Jean",
  "jean.dupont@example.test",
];

describe("parseTrackingWorkbook — aucune ligne référencée n'est perdue (T8)", () => {
  it("conserve une ligne sans prix FAI et la signale", async () => {
    const { rows, stats } = await parse([
      complete("A101"),
      ["Bât. A", "A102", "1", "T2", 45, null, 8.5, "", ""],
    ]);

    expect(rows).toHaveLength(2);
    expect(stats).toEqual({ detected: 2, kept: 2, incomplete: 1 });

    const incomplete = rows.find((r) => r.reference === "A102");
    expect(incomplete?.priceTTC).toBe(0);
    expect(incomplete?.incompleteFields).toEqual(["prix FAI"]);
  });

  it("conserve une ligne sans surface et la signale", async () => {
    const { rows, stats } = await parse([
      complete("A101"),
      ["Bât. A", "A103", "2", "T3", null, 220000, 8.5, "", ""],
    ]);

    expect(rows).toHaveLength(2);
    expect(stats.incomplete).toBe(1);

    const incomplete = rows.find((r) => r.reference === "A103");
    expect(incomplete?.surface).toBe(0);
    expect(incomplete?.incompleteFields).toEqual(["surface"]);
  });

  it("conserve une ligne sans surface NI prix et signale les deux champs", async () => {
    const { rows } = await parse([
      ["Bât. B", "B201", "3", "T4", null, null, null, "", ""],
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.incompleteFields).toEqual(["surface", "prix FAI"]);
    expect(rows[0]?.surface).toBe(0);
    expect(rows[0]?.priceTTC).toBe(0);
  });

  it("conserve une ligne sans acquéreur (un dossier sera créé sans client)", async () => {
    const { rows, stats } = await parse([
      ["Bât. A", "A104", "1", "T2", 45, 180000, 8.5, "", ""],
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.buyerName).toBeNull();
    expect(rows[0]?.buyerEmail).toBeNull();
    // Une ligne sans acquéreur est complète : rien à corriger.
    expect(stats.incomplete).toBe(0);
    expect(rows[0]?.incompleteFields).toEqual([]);
  });

  it("ignore uniquement les lignes dépourvues de référence", async () => {
    const { rows, stats } = await parse([
      complete("A101"),
      ["Bât. A", "", "1", "T2", 45, 180000, 8.5, "", ""],
      complete("A105"),
    ]);

    expect(rows.map((r) => r.reference)).toEqual(["A101", "A105"]);
    expect(stats.detected).toBe(2);
  });

  it("expose le numéro de ligne source pour la correction manuelle", async () => {
    const { rows } = await parse([
      complete("A101"),
      ["Bât. A", "A102", "1", "T2", null, null, 8.5, "", ""],
    ]);

    // Ligne 1 = en-têtes, ligne 2 = A101, ligne 3 = A102.
    expect(rows.find((r) => r.reference === "A102")?.sourceRow).toBe(3);
  });

  it("importe 99 lignes sur 99 même si certaines sont incomplètes", async () => {
    const rowsIn: Row[] = Array.from({ length: 99 }, (_, i) => {
      const ref = `L${i + 1}`;
      // Reproduit le cas signalé : quelques lots sans surface ni prix.
      if ([25, 26, 29, 32, 37, 40].includes(i + 1)) {
        return ["Bât. A", ref, "1", "T2", null, null, 8.5, "", ""];
      }
      return complete(ref);
    });

    const { rows, stats } = await parse(rowsIn);

    expect(rows).toHaveLength(99);
    expect(stats).toEqual({ detected: 99, kept: 99, incomplete: 6 });
  });
});
