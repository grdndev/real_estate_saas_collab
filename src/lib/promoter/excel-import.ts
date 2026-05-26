import ExcelJS from "exceljs";

export interface ParsedLot {
  reference: string;
  surface: number;
  floor: number | null;
  type: string;
  priceHT: number;
  vatRate: number;
  status: "AVAILABLE" | "OPTIONED" | "RESERVED" | "SOLD" | "WITHDRAWN";
}

export interface ParseResult {
  lots: ParsedLot[];
  errors: string[];
}

/** Normalise un libellé de colonne : minuscules, sans accents ni ponctuation. */
function normalize(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Convertit la valeur d'une cellule exceljs en chaîne lisible. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    if (value instanceof Date) return value.toISOString();
  }
  return String(value);
}

/** Parse un nombre français ("123 456,78 €" → 123456.78). */
function parseNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/[€%]/g, "")
    .replace(/,/g, ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const STATUS_MAP: Record<string, ParsedLot["status"]> = {
  disponible: "AVAILABLE",
  dispo: "AVAILABLE",
  libre: "AVAILABLE",
  available: "AVAILABLE",
  optionne: "OPTIONED",
  option: "OPTIONED",
  optioned: "OPTIONED",
  reserve: "RESERVED",
  reserved: "RESERVED",
  vendu: "SOLD",
  sold: "SOLD",
  retire: "WITHDRAWN",
  withdrawn: "WITHDRAWN",
};

const COLUMN_ALIASES: Record<keyof ParsedLot, string[]> = {
  reference: ["reference", "ref", "lot", "nlot", "numero", "numerolot", "nom"],
  surface: [
    "surface",
    "surfacem2",
    "surfacehabitable",
    "shab",
    "m2",
    "superficie",
  ],
  floor: ["etage", "floor", "niveau"],
  type: ["type", "typologie", "typedebien", "categorie"],
  priceHT: ["prixht", "ht", "priceht", "montantht"],
  vatRate: ["tva", "tauxtva", "vat", "vatrate"],
  status: ["statut", "status", "etat", "disponibilite"],
};

/**
 * Parse un classeur Excel (.xlsx) et en extrait la liste des lots.
 * La première ligne non vide est traitée comme en-tête.
 */
export async function parseLotsWorkbook(buffer: Buffer): Promise<ParseResult> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { lots: [], errors: ["Fichier Excel illisible ou corrompu."] };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return {
      lots: [],
      errors: ["Le fichier ne contient aucune feuille de données."],
    };
  }

  // Repère la ligne d'en-tête (première ligne contenant au moins 2 cellules non vides).
  let headerRowIdx = -1;
  for (let i = 1; i <= Math.min(sheet.rowCount, 15); i++) {
    const row = sheet.getRow(i);
    const filled = row.values
      ? (row.values as ExcelJS.CellValue[]).filter(
          (v) => cellText(v).trim() !== "",
        ).length
      : 0;
    if (filled >= 2) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    return {
      lots: [],
      errors: ["Aucune ligne d'en-tête détectée dans le fichier."],
    };
  }

  // Associe chaque colonne du fichier à un champ lot.
  const headerRow = sheet.getRow(headerRowIdx);
  const colMap = new Map<keyof ParsedLot, number>();
  headerRow.eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell.value));
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof ParsedLot,
      string[],
    ][]) {
      if (colMap.has(field)) continue;
      if (aliases.includes(norm)) colMap.set(field, colNumber);
    }
  });

  const missing: string[] = [];
  if (!colMap.has("reference")) missing.push("Référence");
  if (!colMap.has("surface")) missing.push("Surface");
  if (!colMap.has("priceHT")) missing.push("Prix HT");
  if (missing.length > 0) {
    return {
      lots: [],
      errors: [
        `Colonnes obligatoires introuvables : ${missing.join(", ")}. ` +
          "En-têtes attendus : Référence, Surface, Étage, Type, Prix HT, TVA, Statut.",
      ],
    };
  }

  const lots: ParsedLot[] = [];
  const seenRefs = new Set<string>();

  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const get = (field: keyof ParsedLot): string => {
      const col = colMap.get(field);
      return col ? cellText(row.getCell(col).value).trim() : "";
    };

    const reference = get("reference").toUpperCase();
    if (!reference) continue; // ligne vide → ignorée

    const surface = parseNumber(get("surface"));
    const priceHT = parseNumber(get("priceHT"));

    if (surface == null || surface <= 0) {
      errors.push(
        `Ligne ${i} (${reference}) : surface invalide — ligne ignorée.`,
      );
      continue;
    }
    if (priceHT == null || priceHT <= 0) {
      errors.push(
        `Ligne ${i} (${reference}) : prix HT invalide — ligne ignorée.`,
      );
      continue;
    }
    if (seenRefs.has(reference)) {
      errors.push(
        `Ligne ${i} : référence "${reference}" en double — ligne ignorée.`,
      );
      continue;
    }
    seenRefs.add(reference);

    const floorRaw = get("floor");
    const floor = floorRaw ? parseNumber(floorRaw) : null;
    const vatRaw = get("vatRate");
    const vatRate = vatRaw ? (parseNumber(vatRaw) ?? 5.5) : 5.5;
    const statusRaw = normalize(get("status"));
    const status = STATUS_MAP[statusRaw] ?? "AVAILABLE";

    lots.push({
      reference,
      surface,
      floor: floor != null && Number.isFinite(floor) ? Math.trunc(floor) : null,
      type: get("type") || "—",
      priceHT,
      vatRate,
      status,
    });
  }

  if (lots.length === 0) {
    errors.push("Aucun lot valide n'a pu être extrait du fichier.");
  }

  return { lots, errors };
}
