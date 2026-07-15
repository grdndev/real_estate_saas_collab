import ExcelJS from "exceljs";

export interface ParsedLot {
  reference: string;
  surface: number;
  floor: number | null;
  type: string;
  priceHT: number;
  /** TTC importé du fichier, ou null s'il a été déduit du HT. */
  priceTTC: number | null;
  vatRate: number;
  status: "AVAILABLE" | "OPTIONED" | "RESERVED" | "SOLD" | "WITHDRAWN";
}

export interface ParseResult {
  lots: ParsedLot[];
  errors: string[];
}

/** TVA par défaut (%) appliquée quand ni le fichier ni l'appelant n'en fournit. */
export const DEFAULT_VAT_RATE = 8.5;

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

/** Parse un nombre français ("123 456,78 €" → 123456.78, "1.234,56" → 1234.56, "75 m²" → 75). */
function parseNumber(raw: string): number | null {
  let cleaned = raw
    .replace(/\s/g, "")
    .replace(/[€%]/g, "")
    .replace(/m[²2³3]?$/i, "");
  if (cleaned.includes(",")) {
    // Virgule décimale française : les points restants sont des séparateurs de milliers.
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  }
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
  reference: [
    "reference",
    "ref",
    "lot",
    "nlot",
    "numero",
    "numerolot",
    "appartements",
    "appart",
  ],
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
  priceTTC: ["prixttc", "ttc", "prixfai", "fai", "prixnetvendeur"],
  vatRate: ["tva", "tauxtva", "vat", "vatrate"],
  status: ["statut", "status", "etat", "disponibilite"],
};

const EXPECTED_HEADERS_HINT =
  "En-têtes attendus : Référence (ou Appartements), Surface, Étage, Type, Prix HT ou Prix TTC (FAI), TVA, Statut.";

/** Associe les colonnes d'une ligne aux champs lot via les alias connus. */
function mapColumns(row: ExcelJS.Row): Map<keyof ParsedLot, number> {
  const colMap = new Map<keyof ParsedLot, number>();
  row.eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell.value));
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof ParsedLot,
      string[],
    ][]) {
      if (colMap.has(field)) continue;
      if (aliases.includes(norm)) colMap.set(field, colNumber);
    }
  });
  return colMap;
}

/**
 * Repère la ligne d'en-tête d'une feuille : première ligne (parmi les 15
 * premières) dont au moins 2 cellules correspondent à des alias de colonnes.
 * Les lignes de titre (fusionnées ou non) ne matchent aucun alias et sont sautées.
 */
/**
 * Vérifie qu'une ligne d'en-tête a les colonnes obligatoires : référence,
 * surface et au moins une colonne de prix (HT ou TTC).
 */
function hasMandatoryColumns(colMap: Map<keyof ParsedLot, number>): boolean {
  return (
    colMap.has("reference") &&
    colMap.has("surface") &&
    (colMap.has("priceHT") || colMap.has("priceTTC"))
  );
}

function findHeader(
  sheet: ExcelJS.Worksheet,
): { rowIdx: number; colMap: Map<keyof ParsedLot, number> } | null {
  let partial: { rowIdx: number; colMap: Map<keyof ParsedLot, number> } | null =
    null;
  for (let i = 1; i <= Math.min(sheet.rowCount, 15); i++) {
    const colMap = mapColumns(sheet.getRow(i));
    if (hasMandatoryColumns(colMap)) {
      return { rowIdx: i, colMap };
    }
    if (!partial && colMap.size >= 2) partial = { rowIdx: i, colMap };
  }
  return partial;
}

/**
 * Parse un classeur Excel (.xlsx) et en extrait la liste des lots.
 * Toutes les feuilles contenant les colonnes obligatoires sont lues ; les
 * autres (page de garde, notes…) sont ignorées avec un avertissement.
 */
export async function parseLotsWorkbook(
  buffer: Buffer,
  defaultVatRate: number,
): Promise<ParseResult> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { lots: [], errors: ["Fichier Excel illisible ou corrompu."] };
  }

  const sheets = workbook.worksheets;
  if (sheets.length === 0) {
    return {
      lots: [],
      errors: ["Le fichier ne contient aucune feuille de données."],
    };
  }
  const multiSheet = sheets.length > 1;

  const lots: ParsedLot[] = [];
  const seenRefs = new Set<string>();

  for (const sheet of sheets) {
    const where = (line: number) =>
      multiSheet ? `Feuille "${sheet.name}", ligne ${line}` : `Ligne ${line}`;

    if (sheet.rowCount === 0) continue;

    const header = findHeader(sheet);
    if (!header) {
      errors.push(
        multiSheet
          ? `Feuille "${sheet.name}" ignorée : aucune ligne d'en-tête reconnue.`
          : `Aucune ligne d'en-tête détectée dans le fichier. ${EXPECTED_HEADERS_HINT}`,
      );
      continue;
    }

    const { rowIdx: headerRowIdx, colMap } = header;
    const missing: string[] = [];
    if (!colMap.has("reference")) missing.push("Référence");
    if (!colMap.has("surface")) missing.push("Surface");
    if (!colMap.has("priceHT") && !colMap.has("priceTTC"))
      missing.push("Prix HT ou Prix TTC (FAI)");
    if (missing.length > 0) {
      errors.push(
        `${multiSheet ? `Feuille "${sheet.name}" ignorée : c` : "C"}olonnes obligatoires introuvables : ${missing.join(", ")}. ${EXPECTED_HEADERS_HINT}`,
      );
      continue;
    }

    for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const get = (field: keyof ParsedLot): string => {
        const col = colMap.get(field);
        return col ? cellText(row.getCell(col).value).trim() : "";
      };

      const reference = get("reference").toUpperCase();
      if (!reference) {
        // Ligne vide → ignorée sans bruit ; mais une ligne avec des données
        // sans référence est signalée, sinon le lot disparaît en silence.
        if (get("surface") || get("priceHT") || get("priceTTC")) {
          errors.push(`${where(i)} : référence manquante — ligne ignorée.`);
        }
        continue;
      }

      const surface = parseNumber(get("surface"));

      if (surface == null || surface <= 0) {
        errors.push(
          `${where(i)} (${reference}) : surface invalide — ligne ignorée.`,
        );
        continue;
      }
      if (seenRefs.has(reference)) {
        errors.push(
          `${where(i)} : référence "${reference}" en double — ligne ignorée.`,
        );
        continue;
      }

      // La TVA doit être résolue avant les prix : elle sert à déduire le HT
      // quand seul le TTC est fourni. Colonne TVA du fichier prioritaire.
      const vatRaw = get("vatRate");
      let vatRate = vatRaw
        ? (parseNumber(vatRaw) ?? defaultVatRate)
        : defaultVatRate;
      if (vatRate > 0 && vatRate < 1) {
        // Cellule formatée en pourcentage : Excel stocke 0.2 pour "20 %".
        vatRate = Number((vatRate * 100).toFixed(2));
      }
      if (vatRate < 0 || vatRate > 100) {
        errors.push(
          `${where(i)} (${reference}) : TVA "${vatRaw}" invalide — ${defaultVatRate} % appliqué.`,
        );
        vatRate = defaultVatRate;
      }

      // Prix : HT prioritaire s'il est fourni ; sinon HT déduit du TTC.
      const rawHT = colMap.has("priceHT") ? parseNumber(get("priceHT")) : null;
      const rawTTC = colMap.has("priceTTC")
        ? parseNumber(get("priceTTC"))
        : null;
      const hasHT = rawHT != null && rawHT > 0;
      const hasTTC = rawTTC != null && rawTTC > 0;

      let priceHT: number;
      let priceTTC: number | null;
      if (hasHT) {
        priceHT = rawHT;
        // Un TTC présent dans le fichier est conservé tel quel.
        priceTTC = hasTTC ? rawTTC : null;
      } else if (hasTTC) {
        priceHT = Number((rawTTC / (1 + vatRate / 100)).toFixed(2));
        priceTTC = rawTTC;
      } else {
        errors.push(
          `${where(i)} (${reference}) : prix invalide (ni HT ni TTC exploitable) — ligne ignorée.`,
        );
        continue;
      }

      seenRefs.add(reference);

      const floorRaw = get("floor");
      const floor = floorRaw ? parseNumber(floorRaw) : null;
      const statusRaw = normalize(get("status"));
      const status = STATUS_MAP[statusRaw] ?? "AVAILABLE";

      lots.push({
        reference,
        surface,
        floor:
          floor != null && Number.isFinite(floor) ? Math.trunc(floor) : null,
        type: get("type") || "—",
        priceHT,
        priceTTC,
        vatRate,
        status,
      });
    }
  }

  if (lots.length === 0) {
    errors.push("Aucun lot valide n'a pu être extrait du fichier.");
  }

  return { lots, errors };
}
