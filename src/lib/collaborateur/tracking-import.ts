import ExcelJS from "exceljs";
import type {
  ParsedTrackingLot,
  TrackingParseResult,
} from "./tracking-import-types";
export type { ParsedTrackingLot, TrackingParseResult };

const DEFAULT_VAT_RATE = 8.5;

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
  | "priceTTC"
  | "vatRate"
  | "annexSurface"
  | "suv"
  | "garden"
  | "priceNetVendeur"
  | "priceNetVendeurWithParking"
  | "commissionAgence"
  | "commissionAgenceParking"
  | "priceLocation"
  | "creditImpot35"
  | "priceRevientCrdImp"
  | "additionalParking"
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
  | "actSignedAt"
  | "kbisObtainedAt"
  | "clientAtRsm"
  | "deposit200ReceivedAt"
  | "rarSentByNotaryAt";

const COLUMN_ALIASES: Record<MappedField, string[]> = {
  building: ["localisation"],
  reference: ["appartements", "appart", "lot", "nlot"],
  floor: ["etage", "niveau", "floor"],
  type: ["type", "typologie"],
  surface: ["surfacehabitable", "surface", "shab", "m2"],
  priceTTC: ["prixfai", "fai", "prixttc", "ttc"],
  vatRate: ["tva", "tauxtva"],
  annexSurface: ["surfacedesannexes", "annexes"],
  // Surface utile SUV — valeur importée telle quelle, aucun recalcul (T6).
  suv: ["suv", "suvtotal", "surfaceutilesuv", "surfaceutile"],
  garden: ["jardin"],
  priceNetVendeur: ["prixnetvendeur"],
  priceNetVendeurWithParking: ["nvavecplaceparking"],
  commissionAgence: ["commissionagence"],
  commissionAgenceParking: ["capourplaceparking"],
  priceLocation: ["prixalalocation"],
  creditImpot35: ["montantcreditdimpot", "creditimpot"],
  priceRevientCrdImp: ["prixderevient"],
  additionalParking: ["parkingsupplementaire", "parkingsupp", "parking"],
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
  kbisObtainedAt: ["obtentionkbis", "kbis"],
  clientAtRsm: ["clientchezrsm", "rsm"],
  deposit200ReceivedAt: ["receptiondes200", "acompte200"],
  rarSentByNotaryAt: ["envoiparlenotaire", "envoiparnotaire"],
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

  // DD/MM/YYYY — en UTC, comme les dates série Excel et ISO ci-dessous,
  // pour que la date calendaire ne dépende pas du fuseau du serveur.
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(
      Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])),
    );
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

const TRUE_VALUES = new Set(["oui", "o", "yes", "y", "x", "ok", "1", "vrai"]);
const FALSE_VALUES = new Set(["non", "n", "no", "0", "faux"]);

function parseBoolean(raw: string): boolean | null {
  if (!raw) return null;
  const norm = normalize(raw);
  if (FALSE_VALUES.has(norm)) return false;
  if (TRUE_VALUES.has(norm)) return true;
  return true;
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

/** Rapport vide, utilisé quand le fichier n'a pas pu être lu du tout. */
const EMPTY_STATS = { detected: 0, kept: 0, incomplete: 0 } as const;

export async function parseTrackingWorkbook(
  buffer: Buffer,
): Promise<TrackingParseResult> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return {
      rows: [],
      stats: EMPTY_STATS,
      errors: ["Fichier Excel illisible ou corrompu."],
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return {
      rows: [],
      stats: EMPTY_STATS,
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
      stats: EMPTY_STATS,
      errors: ["Aucune ligne d'en-tête détectée dans le fichier."],
    };
  }

  const headerRow = sheet.getRow(headerRowIdx);

  // Mapper les colonnes → champ typé
  const colMap = new Map<MappedField, number>();
  // Pour "type" / "typologie" : prendre la 2ème occurrence si deux colonnes "type"
  const typeOccurrences: number[] = [];

  const aliasEntries = Object.entries(COLUMN_ALIASES) as [
    MappedField,
    string[],
  ][];

  // En-têtes normalisés, indexés par numéro de colonne (ordre croissant).
  const headers = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell.value));
    if (norm) headers.set(colNumber, norm);
  });

  const isMapped = (field: MappedField): boolean =>
    field === "type" ? typeOccurrences.length > 0 : colMap.has(field);

  const assign = (field: MappedField, colNumber: number): void => {
    if (field === "type") {
      typeOccurrences.push(colNumber);
    } else if (!colMap.has(field)) {
      colMap.set(field, colNumber);
    }
  };

  // Passe 1 — égalité stricte. Prioritaire : un en-tête exact ne peut pas être
  // capté par le match approximatif d'une autre colonne (passe 2).
  const consumed = new Set<number>();
  for (const [colNumber, norm] of headers) {
    for (const [field, aliases] of aliasEntries) {
      if (aliases.includes(norm)) {
        assign(field, colNumber);
        consumed.add(colNumber);
        break;
      }
    }
  }

  // Passe 2 — sous-chaîne, alias le plus long gagnant. Le fichier de suivi
  // contient des en-têtes enrichis (« Surface des annexes (Varangue, porche,
  // terrasse) », « SUV Total (Habitable+annexe) ») que l'égalité ne capte pas.
  // Le critère de longueur départage les alias imbriqués : « surfacedesannexes »
  // l'emporte sur « surface », « receptiondudepotdegarantie » sur « garantie ».
  for (const [colNumber, norm] of headers) {
    if (consumed.has(colNumber)) continue;

    let best: { field: MappedField; length: number } | null = null;
    for (const [field, aliases] of aliasEntries) {
      if (isMapped(field)) continue;
      for (const alias of aliases) {
        if (norm.includes(alias) && (!best || alias.length > best.length)) {
          best = { field, length: alias.length };
        }
      }
    }
    if (best) assign(best.field, colNumber);
  }

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

    // Toute ligne possédant une référence est conservée (T8). Une valeur
    // obligatoire absente est remplacée par une valeur neutre et signalée :
    // la ligne reste corrigeable à l'étape de vérification.
    const incompleteFields: string[] = [];

    const parsedSurface = parseNumber(getText("surface"));
    const surface =
      parsedSurface != null && parsedSurface > 0 ? parsedSurface : 0;
    if (surface === 0) incompleteFields.push("surface");

    // TVA résolue d'abord : elle sert à déduire le HT depuis le TTC.
    const vatRaw = getText("vatRate");
    const vatRate = vatRaw
      ? (parseNumber(vatRaw) ?? DEFAULT_VAT_RATE)
      : DEFAULT_VAT_RATE;

    // Le prix vient uniquement de la colonne "Prix FAI" (TTC) ; le HT en est déduit.
    const parsedPriceTTC = parseNumber(getText("priceTTC"));
    const priceTTC =
      parsedPriceTTC != null && parsedPriceTTC > 0 ? parsedPriceTTC : 0;
    if (priceTTC === 0) incompleteFields.push("prix FAI");
    const priceHT = Number((priceTTC / (1 + vatRate / 100)).toFixed(2));

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

    const loanFiledCell = getCell("loanFiled");
    const loanObtainedCell = getCell("loanObtained");

    rows.push({
      building: getText("building") || null,
      reference,
      floor: parseFloor(getText("floor")),
      type: getText("type") || "—",
      surface,
      priceHT,
      priceTTC,
      vatRate,
      lotStatus,
      lotNotes: null,
      annexSurface: parseNumber(getText("annexSurface")),
      suv: parseNumber(getText("suv")),
      garden: parseNumber(getText("garden")),
      priceNetVendeur: parseNumber(getText("priceNetVendeur")),
      priceNetVendeurWithParking: parseNumber(
        getText("priceNetVendeurWithParking"),
      ),
      commissionAgence: parseNumber(getText("commissionAgence")),
      commissionAgenceParking: parseNumber(getText("commissionAgenceParking")),
      priceLocation: parseNumber(getText("priceLocation")),
      creditImpot35: parseNumber(getText("creditImpot35")),
      priceRevientCrdImp: parseNumber(getText("priceRevientCrdImp")),
      additionalParking: parseBoolean(getText("additionalParking")),
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
      loanFiled: parseLoanFiled(loanFiledCell),
      loanObtained: parseLoanObtained(loanObtainedCell),
      reservationEndDate: parseDate(getCell("reservationEndDate")),
      actSignedAt,
      kbisObtainedAt: parseDate(getCell("kbisObtainedAt")),
      clientAtRsm: parseBoolean(getText("clientAtRsm")),
      deposit200ReceivedAt: parseDate(getCell("deposit200ReceivedAt")),
      rarSentByNotaryAt: parseDate(getCell("rarSentByNotaryAt")),
      loanFiledAt: parseDate(loanFiledCell),
      loanObtainedAt: parseDate(loanObtainedCell),
      sourceRow: i,
      incompleteFields,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Aucune ligne valide n'a pu être extraite du fichier.");
  }

  const incomplete = rows.filter((r) => r.incompleteFields.length > 0).length;

  return {
    rows,
    errors,
    stats: { detected: rows.length, kept: rows.length, incomplete },
  };
}
