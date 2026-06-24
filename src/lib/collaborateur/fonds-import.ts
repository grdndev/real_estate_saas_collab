import ExcelJS from "exceljs";
import type {
  ParsedFondsAppel,
  ParsedFondsLot,
  ParsedFondsAppelType,
  FondsParseResult,
} from "./fonds-import-types";

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

function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  const raw = cellText(value).trim();
  if (!raw) return null;

  const norm = normalize(raw);
  if (norm === "ok" || norm === "x") return null;

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  const num = Number(raw);
  if (Number.isFinite(num) && num > 1) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

const SKIP_LOT_NORMS = new Set(["total", "envoi", "recu", "solde", ""]);

function detectHeaderRow(sheet: ExcelJS.Worksheet): { rowIdx: number } | null {
  for (let i = 1; i <= Math.min(sheet.rowCount, 20); i++) {
    const row = sheet.getRow(i);
    let hasLot = false;
    row.eachCell((cell) => {
      if (normalize(cellText(cell.value)) === "lot") hasLot = true;
    });
    if (hasLot) return { rowIdx: i };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Feuil1 parser
// ---------------------------------------------------------------------------

interface AppelColInfo {
  colNumber: number;
  originalHeader: string;
  numero: number;
  pourcentage: number;
  datePrevue: string | null;
  label: string;
  mois: string | null;
  annee: number | null;
}

function tryBuildAppelColInfo(
  raw: string,
  colNumber: number,
): AppelColInfo | null {
  const norm = normalize(raw);
  if (!norm.startsWith("appeldefonds") && !norm.startsWith("appeldofonds"))
    return null;

  const numMatch = raw.match(/\((\d+)\)/);
  if (!numMatch) return null;
  const numero = parseInt(numMatch[1]!, 10);

  const pctMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const pourcentage = pctMatch ? parseFloat(pctMatch[1]!.replace(",", ".")) : 0;

  const yearMatch = raw.match(/(\d{4})/);
  const annee = yearMatch ? parseInt(yearMatch[1]!, 10) : null;

  const afterNum = raw.slice(raw.indexOf(numMatch[0]!) + numMatch[0]!.length);

  let mois: string | null = null;
  if (yearMatch) {
    const yearIdx = afterNum.indexOf(yearMatch[0]!);
    if (yearIdx >= 0) {
      mois = afterNum.slice(0, yearIdx).trim() || null;
    }
  }

  let datePrevue: string | null = null;
  if (pctMatch) {
    const beforePct = afterNum.slice(0, afterNum.indexOf(pctMatch[0]!)).trim();
    datePrevue = beforePct || null;
  }

  return {
    colNumber,
    originalHeader: raw,
    numero,
    pourcentage,
    datePrevue,
    label: raw,
    mois,
    annee,
  };
}

function parseSheet1(sheet: ExcelJS.Worksheet): {
  lots: Map<string, ParsedFondsLot>;
  appelCols: AppelColInfo[];
} {
  const lots = new Map<string, ParsedFondsLot>();
  const detected = detectHeaderRow(sheet);
  if (!detected) return { lots, appelCols: [] };
  const { rowIdx: headerRowIdx } = detected;
  const headerRow = sheet.getRow(headerRowIdx);

  let colLot: number | null = null;
  let colNom: number | null = null;
  let colDateSignature: number | null = null;
  let colCommission: number | null = null;
  let colFraisMainLevee: number | null = null;
  let colRbstEdd: number | null = null;
  let colSoldeVendeur: number | null = null;
  const appelCols: AppelColInfo[] = [];

  headerRow.eachCell((cell, colNumber) => {
    const raw = cellText(cell.value);
    const norm = normalize(raw);
    if (!norm) return;

    if (norm === "lot") {
      colLot = colLot ?? colNumber;
      return;
    }
    if (norm === "nom") {
      colNom = colNom ?? colNumber;
      return;
    }
    if (norm === "datesignatureacte" || norm.includes("signature")) {
      colDateSignature = colDateSignature ?? colNumber;
      return;
    }
    if (norm === "com") {
      colCommission = colCommission ?? colNumber;
      return;
    }
    if (norm.includes("fraismainlevee") || norm.includes("fraisdemainkevee")) {
      colFraisMainLevee = colFraisMainLevee ?? colNumber;
      return;
    }
    if (norm === "rbstedd") {
      colRbstEdd = colRbstEdd ?? colNumber;
      return;
    }
    if (norm === "soldevendeur") {
      colSoldeVendeur = colSoldeVendeur ?? colNumber;
      return;
    }

    const info = tryBuildAppelColInfo(raw, colNumber);
    if (info) appelCols.push(info);
  });

  // Scan rows 1..headerRowIdx+1 to catch appel headers in merged cells above the header row
  for (let r = 1; r <= headerRowIdx + 1; r++) {
    const scanRow = sheet.getRow(r);
    scanRow.eachCell((cell, colNumber) => {
      if (appelCols.some((ac) => ac.colNumber === colNumber)) return;
      const raw = cellText(cell.value);
      const info = tryBuildAppelColInfo(raw, colNumber);
      if (info) appelCols.push(info);
    });
  }

  appelCols.sort((a, b) => a.numero - b.numero);

  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);

    const lotRef = colLot ? cellText(row.getCell(colLot).value).trim() : "";
    if (!lotRef || SKIP_LOT_NORMS.has(normalize(lotRef))) continue;

    const nomRaw = colNom ? cellText(row.getCell(colNom).value).trim() : "";
    const commissionRaw = colCommission
      ? cellText(row.getCell(colCommission).value).trim()
      : "";
    const fraisRaw = colFraisMainLevee
      ? cellText(row.getCell(colFraisMainLevee).value).trim()
      : "";
    const rbstRaw = colRbstEdd
      ? cellText(row.getCell(colRbstEdd).value).trim()
      : "";
    const soldeRaw = colSoldeVendeur
      ? cellText(row.getCell(colSoldeVendeur).value).trim()
      : "";

    const dateSignatureVal = colDateSignature
      ? row.getCell(colDateSignature).value
      : null;

    const appelsFonds: ParsedFondsAppel[] = [];
    for (const ac of appelCols) {
      const montantRaw = cellText(row.getCell(ac.colNumber).value).trim();
      const montant = parseNumber(montantRaw);
      if (montant == null || montant === 0) continue;
      appelsFonds.push({
        numero: ac.numero,
        label: ac.label,
        datePrevue: ac.datePrevue,
        pourcentage: ac.pourcentage,
        montant,
      });
    }

    lots.set(lotRef, {
      lotReference: lotRef,
      nomAcquereur: nomRaw || null,
      dateSignatureActe: parseDate(dateSignatureVal),
      commission: parseNumber(commissionRaw),
      fraisMainLevee: parseNumber(fraisRaw),
      rbstEdd: parseNumber(rbstRaw),
      soldeVendeur: parseNumber(soldeRaw),
      dateEnvoiLr: null,
      dateReceptionLr: null,
      dateReceptionVirement: null,
      notes: null,
      appelsFonds,
    });
  }

  return { lots, appelCols };
}

// ---------------------------------------------------------------------------
// Feuil4 parser — enrichit la map existante
// ---------------------------------------------------------------------------

function parseSheet4(
  sheet: ExcelJS.Worksheet,
  map: Map<string, ParsedFondsLot>,
): void {
  const detected = detectHeaderRow(sheet);
  if (!detected) return;
  const { rowIdx: headerRowIdx } = detected;
  const headerRow = sheet.getRow(headerRowIdx);

  let colLot: number | null = null;
  let colEnvoiLr: number | null = null;
  let colReceptionLr: number | null = null;
  let colReceptionVirement: number | null = null;
  let colCommentaire: number | null = null;

  headerRow.eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell.value));
    if (!norm) return;

    if (norm === "lot") {
      colLot = colLot ?? colNumber;
      return;
    }
    if (norm === "dateenvoilr" || norm === "envoilr") {
      colEnvoiLr = colEnvoiLr ?? colNumber;
      return;
    }
    if (norm === "datereceptionlr" || norm === "receptionlr") {
      colReceptionLr = colReceptionLr ?? colNumber;
      return;
    }
    if (norm === "datereceptionduvirement" || norm === "receptionvirement") {
      colReceptionVirement = colReceptionVirement ?? colNumber;
      return;
    }
    if (norm.startsWith("commentaire")) {
      colCommentaire = colCommentaire ?? colNumber;
      return;
    }
  });

  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const lotRef = colLot ? cellText(row.getCell(colLot).value).trim() : "";
    if (!lotRef || SKIP_LOT_NORMS.has(normalize(lotRef))) continue;

    const entry = map.get(lotRef);
    if (!entry) continue;

    if (colEnvoiLr)
      entry.dateEnvoiLr = parseDate(row.getCell(colEnvoiLr).value);
    if (colReceptionLr)
      entry.dateReceptionLr = parseDate(row.getCell(colReceptionLr).value);
    if (colReceptionVirement)
      entry.dateReceptionVirement = parseDate(
        row.getCell(colReceptionVirement).value,
      );
    if (colCommentaire) {
      const c = cellText(row.getCell(colCommentaire).value).trim();
      if (c) entry.notes = c;
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parseFondsWorkbook(
  buffer: Buffer,
): Promise<FondsParseResult> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return {
      rows: [],
      appelTypes: [],
      errors: ["Fichier Excel illisible ou corrompu."],
    };
  }

  const sheet1 = workbook.worksheets[0];
  if (!sheet1 || sheet1.rowCount === 0) {
    return {
      rows: [],
      appelTypes: [],
      errors: ["Le fichier ne contient aucune feuille de données."],
    };
  }

  const { lots: lotMap, appelCols } = parseSheet1(sheet1);

  const sheet4 = workbook.worksheets[1] ?? workbook.getWorksheet("Feuil4");
  if (sheet4 && sheet4.rowCount > 0) {
    parseSheet4(sheet4, lotMap);
  }

  const rows = Array.from(lotMap.values());

  const appelTypes: ParsedFondsAppelType[] = appelCols
    .sort((a, b) => a.numero - b.numero)
    .map((ac) => ({
      numero: ac.numero,
      label: ac.label,
      mois: ac.mois ?? "",
      annee: ac.annee ?? 0,
      pourcentage: ac.pourcentage,
    }));

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Aucune ligne valide n'a pu être extraite du fichier.");
  }

  return { rows, appelTypes, errors };
}
