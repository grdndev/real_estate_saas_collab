import ExcelJS from "exceljs";
import type {
  ParsedTrackingLot,
  TrackingParseResult,
} from "./tracking-import-types";
export type { ParsedTrackingLot, TrackingParseResult };

function normalize(s: string): string {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

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

function parseNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/[€%]/g, "")
    .replace(/,/g, ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Colonnes mappées vers des champs typés
type MappedField =
  | "building"
  | "reference"
  | "floor"
  | "type"
  | "surface"
  | "priceHT"
  | "vatRate"
  | "buyerName"
  | "buyerPhone"
  | "buyerEmail"
  | "observation"
  | "financingMode"
  | "optionDate"
  | "reservationSignedAt"
  | "notaryTransmittedAt"
  | "guaranteeDepositAmount"
  | "guaranteeDepositReceivedAt"
  | "loanFiled"
  | "loanObtained"
  | "reservationEndDate"
  | "actSignedAt";

// Colonnes dont la valeur brute est concaténée dans lotNotes avec un libellé lisible
type NotesField =
  | "kbis"
  | "rsm"
  | "parking"
  | "acompte200"
  | "envoiparnotaire"
  | "prixfai"
  | "nvavecplaceparking"
  | "suvtotal"
  | "suv"
  | "surfacedesannexes"
  | "annexes"
  | "jardin"
  | "commissionagence"
  | "capourplaceparking"
  | "prixalalocation"
  | "montantcreditdimpot"
  | "creditimpot"
  | "prixderevient";

const NOTES_LABELS: Record<NotesField, string> = {
  kbis: "Obtention Kbis",
  rsm: "Client chez RSM",
  parking: "Parking supplémentaire",
  acompte200: "Réception des 200€",
  envoiparnotaire: "Envoi par le notaire",
  prixfai: "Prix FAI",
  nvavecplaceparking: "NV avec place parking",
  suvtotal: "SUV total",
  suv: "SUV",
  surfacedesannexes: "Surface des annexes",
  annexes: "Annexes",
  jardin: "Jardin",
  commissionagence: "Commission agence",
  capourplaceparking: "CA pour place parking",
  prixalalocation: "Prix à la location",
  montantcreditdimpot: "Montant crédit d'impôt",
  creditimpot: "Crédit d'impôt",
  prixderevient: "Prix de revient",
};

const COLUMN_ALIASES: Record<MappedField, string[]> = {
  building: ["localisation"],
  reference: ["appartements", "appart", "lot", "nlot"],
  floor: ["etage", "niveau", "floor"],
  type: ["type", "typologie"],
  surface: ["surfacehabitable", "surface", "shab", "m2"],
  priceHT: ["prixnetvendeur", "prixnet", "prixhtvendeur"],
  vatRate: ["tva", "tauxtva"],
  buyerName: ["nom"],
  buyerPhone: ["tel", "telephone"],
  buyerEmail: ["mail", "email"],
  observation: ["observation", "observations"],
  financingMode: ["modedefinancement", "financement", "modedefin"],
  optionDate: ["option"],
  reservationSignedAt: [
    "signaturecontratderesa",
    "signatureresa",
    "signaturecontrat",
  ],
  notaryTransmittedAt: [
    "envoicontratresachezlenotaire",
    "envoinotaire",
    "envoicontratnotaire",
  ],
  guaranteeDepositAmount: ["depotdegarantie", "garantie", "montantgarantie"],
  guaranteeDepositReceivedAt: [
    "receptiondudepotdegarantie",
    "receptiongarantie",
  ],
  loanFiled: ["depotdepret", "depotpret"],
  loanObtained: ["obtentiondepret", "obtentionpret"],
  reservationEndDate: ["datedefindcontratderesa", "fincontratresa", "finresa"],
  actSignedAt: ["acte"],
};

const NOTES_ALIASES: Record<NotesField, string[]> = {
  kbis: ["obtentionkbis", "kbis"],
  rsm: ["clientchezrsm", "rsm"],
  parking: ["parkingsupplementaire", "parkingsupp", "parking"],
  acompte200: ["receptiondes200", "200€", "acompte200"],
  envoiparnotaire: ["envoiparlenotaire", "envoiparnotaire"],
  prixfai: ["prixfai", "fai"],
  nvavecplaceparking: ["nvavecplaceparking"],
  suvtotal: ["suvtotal"],
  suv: ["suv"],
  surfacedesannexes: ["surfacedesannexes"],
  annexes: ["annexes"],
  jardin: ["jardin"],
  commissionagence: ["commissionagence"],
  capourplaceparking: ["capourplaceparking"],
  prixalalocation: ["prixalalocation"],
  montantcreditdimpot: ["montantcreditdimpot"],
  creditimpot: ["creditimpot"],
  prixderevient: ["prixderevient"],
};

const FLOOR_TEXT: Record<string, number> = {
  rdc: 0,
  rc: 0,
  "r+1": 1,
  "r+2": 2,
  "r+3": 3,
  "r+4": 4,
  "r+5": 5,
  "r+6": 6,
  "r+7": 7,
  "r+8": 8,
  "r+9": 9,
};

function parseFloor(raw: string): number | null {
  if (!raw) return null;
  const norm = normalize(raw);
  if (norm in FLOOR_TEXT) return FLOOR_TEXT[norm]!;
  // "R+1" → normalize → "r1" : extraire le premier entier trouvé
  const digits = norm.match(/\d+/);
  if (digits) {
    const n = parseInt(digits[0]!, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  const raw = cellText(value).trim();
  if (!raw) return null;

  const norm = normalize(raw);
  if (norm === "ok" || norm === "x") return null;

  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  // ExcelJS sometimes gives numeric serial dates as strings
  const num = Number(raw);
  if (Number.isFinite(num) && num > 1) {
    // Excel date serial (days since 1899-12-30)
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function parseLoanFiled(value: ExcelJS.CellValue): boolean | Date | null {
  if (value == null) return null;
  const raw = cellText(value).trim();
  if (!raw) return null;
  if (normalize(raw) === "x") return true;
  const d = parseDate(value);
  return d;
}

function parseLoanObtained(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;
  const raw = cellText(value).trim();
  if (!raw) return null;
  const norm = normalize(raw);
  if (
    norm === "sanspret" ||
    norm === "sanspret" ||
    norm.includes("sanspret") ||
    norm === "comptant"
  )
    return "cash";
  const d = parseDate(value);
  if (d) return d.toISOString();
  return raw;
}

export async function parseTrackingWorkbook(
  buffer: Buffer,
): Promise<TrackingParseResult> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: ["Fichier Excel illisible ou corrompu."] };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return {
      rows: [],
      errors: ["Le fichier ne contient aucune feuille de données."],
    };
  }

  // Détecter la ligne d'en-tête (première ligne avec ≥ 3 cellules non vides)
  let headerRowIdx = -1;
  for (let i = 1; i <= Math.min(sheet.rowCount, 20); i++) {
    const row = sheet.getRow(i);
    const filled = row.values
      ? (row.values as ExcelJS.CellValue[]).filter(
          (v) => cellText(v).trim() !== "",
        ).length
      : 0;
    if (filled >= 3) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    return {
      rows: [],
      errors: ["Aucune ligne d'en-tête détectée dans le fichier."],
    };
  }

  const headerRow = sheet.getRow(headerRowIdx);

  // Mapper les colonnes → champ typé
  const colMap = new Map<MappedField, number>();
  // Pour "type" / "typologie" : prendre la 2ème occurrence si deux colonnes "type"
  const typeOccurrences: number[] = [];

  // Mapper les colonnes → champ notes
  const notesColMap = new Map<NotesField, number>();

  headerRow.eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell.value));
    if (!norm) return;

    // Colonnes typées
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      MappedField,
      string[],
    ][]) {
      if (aliases.includes(norm)) {
        if (field === "type") {
          typeOccurrences.push(colNumber);
        } else if (!colMap.has(field)) {
          colMap.set(field, colNumber);
        }
        return;
      }
    }

    // Colonnes notes
    for (const [noteKey, aliases] of Object.entries(NOTES_ALIASES) as [
      NotesField,
      string[],
    ][]) {
      if (aliases.includes(norm) && !notesColMap.has(noteKey)) {
        notesColMap.set(noteKey, colNumber);
        return;
      }
    }
  });

  // Résoudre la colonne "type" : 2ème occurrence si disponible
  if (typeOccurrences.length >= 2) {
    colMap.set("type", typeOccurrences[1]!);
  } else if (typeOccurrences.length === 1) {
    colMap.set("type", typeOccurrences[0]!);
  }

  const rows: ParsedTrackingLot[] = [];

  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);

    const getCell = (field: MappedField): ExcelJS.CellValue => {
      const col = colMap.get(field);
      return col ? row.getCell(col).value : null;
    };
    const getText = (field: MappedField): string =>
      cellText(getCell(field)).trim();

    const reference = getText("reference");
    if (!reference) continue;

    const surface = parseNumber(getText("surface"));
    const priceHT = parseNumber(getText("priceHT"));

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

    const vatRaw = getText("vatRate");
    const vatRate = vatRaw ? (parseNumber(vatRaw) ?? 5.5) : 5.5;

    const optionDate = parseDate(getCell("optionDate"));
    const reservationSignedAt = parseDate(getCell("reservationSignedAt"));
    const actSignedAt = parseDate(getCell("actSignedAt"));

    let lotStatus: ParsedTrackingLot["lotStatus"] = "AVAILABLE";
    if (actSignedAt) {
      lotStatus = "SOLD";
    } else if (reservationSignedAt) {
      lotStatus = "RESERVED";
    } else if (optionDate) {
      lotStatus = "OPTIONED";
    }

    // Construire lotNotes depuis les colonnes notes non vides
    const notesParts: string[] = [];
    for (const [noteKey, col] of notesColMap.entries()) {
      const val = cellText(row.getCell(col).value).trim();
      if (val) {
        const label = NOTES_LABELS[noteKey];
        notesParts.push(`${label}: ${val}`);
      }
    }
    const lotNotes = notesParts.length > 0 ? notesParts.join(" | ") : null;

    rows.push({
      building: getText("building") || null,
      reference,
      floor: parseFloor(getText("floor")),
      type: getText("type") || "—",
      surface,
      priceHT,
      vatRate,
      lotStatus,
      lotNotes,
      buyerName: getText("buyerName") || null,
      buyerEmail: getText("buyerEmail") || null,
      buyerPhone: getText("buyerPhone") || null,
      observation: getText("observation") || null,
      financingMode: getText("financingMode") || null,
      optionDate,
      reservationSignedAt,
      notaryTransmittedAt: parseDate(getCell("notaryTransmittedAt")),
      guaranteeDepositAmount: parseNumber(getText("guaranteeDepositAmount")),
      guaranteeDepositReceivedAt: parseDate(
        getCell("guaranteeDepositReceivedAt"),
      ),
      loanFiled: parseLoanFiled(getCell("loanFiled")),
      loanObtained: parseLoanObtained(getCell("loanObtained")),
      reservationEndDate: parseDate(getCell("reservationEndDate")),
      actSignedAt,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Aucune ligne valide n'a pu être extraite du fichier.");
  }

  return { rows, errors };
}
