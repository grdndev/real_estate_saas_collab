import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { DEFAULT_VAT_RATE, parseLotsWorkbook } from "./excel-import";

const HEADERS = [
  "Référence",
  "Surface",
  "Étage",
  "Type",
  "Prix HT",
  "TVA",
  "Statut",
];

type Row = (string | number | null)[];

async function buildWorkbook(
  build: (wb: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Row[]) {
  const ws = wb.addWorksheet(name);
  for (const r of rows) ws.addRow(r);
  return ws;
}

/** Parse en fournissant la TVA par défaut (8,5 % sauf indication contraire). */
function parse(buffer: Buffer, defaultVatRate = DEFAULT_VAT_RATE) {
  return parseLotsWorkbook(buffer, defaultVatRate);
}

const lot = (
  ref: string,
  surface: number | string,
  prix: number | string,
  tva: number | string = 20,
): Row => [ref, surface, 1, "T2", prix, tva, "Disponible"];

describe("parseLotsWorkbook", () => {
  it("importe les lots de toutes les feuilles", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Bâtiment A", [HEADERS, lot("A101", 45, 200000)]);
      addSheet(wb, "Bâtiment B", [HEADERS, lot("B101", 62, 260000)]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots.map((l) => l.reference)).toEqual(["A101", "B101"]);
    expect(errors).toEqual([]);
  });

  it("ignore une page de garde avec avertissement et lit la feuille de lots", async () => {
    const buffer = await buildWorkbook((wb) => {
      const cover = wb.addWorksheet("Présentation");
      cover.getCell("A1").value = "Résidence Les Jardins";
      cover.getCell("A3").value = "Promoteur :";
      cover.getCell("B3").value = "Equatis";
      addSheet(wb, "Lots", [HEADERS, lot("A101", 45, 200000)]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(1);
    expect(errors).toEqual([
      'Feuille "Présentation" ignorée : aucune ligne d\'en-tête reconnue.',
    ]);
  });

  it("signale une ligne avec données mais sans référence", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        HEADERS,
        lot("A101", 45, 200000),
        ["", 62, 1, "T3", 260000, 20, "Disponible"],
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(1);
    expect(errors).toEqual(["Ligne 3 : référence manquante — ligne ignorée."]);
  });

  it("ignore les lignes totalement vides sans avertissement", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        HEADERS,
        lot("A101", 45, 200000),
        [null, null, null, null, null, null, null],
        lot("A102", 62, 260000),
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  it('accepte une surface en texte "75 m²"', async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [HEADERS, lot("A101", "75 m²", 200000)]);
    });
    const { lots } = await parse(buffer);
    expect(lots[0]?.surface).toBe(75);
  });

  it("accepte les formats numériques français", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        HEADERS,
        lot("A101", 45, "1.234,56"),
        lot("A102", 62, "234 567,89 €"),
        lot("A103", "12,5", 300000),
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(errors).toEqual([]);
    expect(lots.map((l) => l.priceHT)).toEqual([1234.56, 234567.89, 300000]);
    expect(lots[2]?.surface).toBe(12.5);
  });

  it("rejette un doublon de référence (insensible à la casse) avec avertissement", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        HEADERS,
        lot("a101", 45, 200000),
        lot("A101", 62, 260000),
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(1);
    expect(errors).toEqual([
      'Ligne 3 : référence "A101" en double — ligne ignorée.',
    ]);
  });

  it("saute une ligne de titre fusionnée avant l'en-tête", async () => {
    const buffer = await buildWorkbook((wb) => {
      const ws = wb.addWorksheet("Grille");
      ws.addRow(["PROGRAMME LES JARDINS — GRILLE DE PRIX 2026"]);
      ws.mergeCells("A1:G1");
      ws.addRow([]);
      ws.addRow(HEADERS);
      ws.addRow(lot("A101", 45, 200000));
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("saute une ligne de titre à plusieurs cellules avant l'en-tête", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Grille", [
        ["Résidence Les Jardins", "MAJ 01/07/2026"],
        HEADERS,
        lot("A101", 45, 200000),
      ]);
    });
    const { lots } = await parse(buffer);
    expect(lots).toHaveLength(1);
  });

  it("convertit une TVA en cellule formatée pourcentage (0.2 → 20)", async () => {
    const buffer = await buildWorkbook((wb) => {
      const ws = addSheet(wb, "Lots", [
        HEADERS,
        lot("A101", 45, 200000, 0.2),
        lot("A102", 62, 260000, 20),
      ]);
      ws.getCell("F2").numFmt = "0%";
    });
    const { lots } = await parse(buffer);
    expect(lots.map((l) => l.vatRate)).toEqual([20, 20]);
  });

  it("applique la TVA par défaut avec avertissement si le taux est aberrant", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [HEADERS, lot("A101", 45, 200000, 250)]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots[0]?.vatRate).toBe(8.5);
    expect(errors[0]).toContain("TVA");
  });

  it("échoue explicitement si les colonnes obligatoires manquent", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        ["Référence", "Type"],
        ["A101", "T2"],
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(lots).toHaveLength(0);
    expect(errors[0]).toContain("Colonnes obligatoires introuvables");
  });

  it("laisse le HT inchangé et ne déduit pas de TTC quand seul le HT est fourni", async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [HEADERS, lot("A101", 45, 200000, 20)]);
    });
    const { lots, errors } = await parse(buffer);
    expect(errors).toEqual([]);
    expect(lots[0]?.priceHT).toBe(200000);
    expect(lots[0]?.priceTTC).toBeNull();
    expect(lots[0]?.vatRate).toBe(20);
  });

  it("déduit le HT depuis un TTC seul avec la TVA par défaut 8,5 %", async () => {
    const buffer = await buildWorkbook((wb) => {
      // Feuille au format promoteur : pas de Prix HT, colonne "Prix FAI" (TTC).
      addSheet(wb, "SUIVI CLIENTS", [
        ["Appartements", "Surface", "Type", "Prix FAI"],
        ["A101", 45, "T2", 108500],
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(errors).toEqual([]);
    expect(lots).toHaveLength(1);
    expect(lots[0]?.vatRate).toBe(8.5);
    expect(lots[0]?.priceTTC).toBe(108500);
    // 108500 / 1.085 = 100000 exactement.
    expect(lots[0]?.priceHT).toBe(100000);
  });

  it('lit la référence depuis la colonne "Appartements"', async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "Lots", [
        ["Appartements", "Surface", "Type", "Prix HT"],
        ["B204", 62, "T3", 260000],
      ]);
    });
    const { lots, errors } = await parse(buffer);
    expect(errors).toEqual([]);
    expect(lots.map((l) => l.reference)).toEqual(["B204"]);
  });

  it('n\'utilise pas la colonne "Nom" (nom du client) comme référence', async () => {
    const buffer = await buildWorkbook((wb) => {
      addSheet(wb, "SUIVI CLIENTS", [
        ["Nom", "Appartements", "Surface", "Prix FAI"],
        ["Dupont", "A101", 45, 108500],
      ]);
    });
    const { lots } = await parse(buffer);
    expect(lots).toHaveLength(1);
    // La référence vient de "Appartements", pas du nom du client.
    expect(lots[0]?.reference).toBe("A101");
  });
});
