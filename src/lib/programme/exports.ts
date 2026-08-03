import { prisma } from "@/lib/prisma";
import { csvResponse, rowsToCsv } from "@/lib/csv";
import { generateLotsPdf } from "@/lib/promoter/pdf-lots";
import {
  generateTreasuryPdf,
  type TreasuryPdfMonth,
} from "@/lib/promoter/pdf-treasury";
import { rollingMonths } from "@/lib/programme/access";
import { sortByLotReference } from "@/lib/lot/sort";
import { slugify } from "@/lib/utils";

/**
 * Exports « suivi de programme » (grille des lots, trésorerie), partagés entre
 * les routes promoteur et admin (T3/T15).
 *
 * Aucun de ces exports ne contient de donnée nominative de client (T1).
 */

const STATUS_LABEL = {
  AVAILABLE: "Disponible",
  OPTIONED: "Optionné",
  RESERVED: "Réservé",
  SOLD: "Vendu",
  WITHDRAWN: "Retiré",
} as const;

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pdfResponse(pdf: Uint8Array, filename: string): Response {
  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}

export async function lotsCsvExport(
  programmeId: string,
  programmeName: string,
): Promise<Response> {
  // Tri naturel, identique à celui de la grille affichée (T13).
  const lots = sortByLotReference(
    await prisma.lot.findMany({ where: { programmeId } }),
    (l) => l.reference,
  );

  const csv = rowsToCsv(
    [
      "Référence",
      "Surface habitable (m²)",
      "Surface annexe (m²)",
      "Surface utile SUV (m²)",
      "Étage",
      "Type",
      "Prix HT (€)",
      "TVA (%)",
      "Prix TTC (€)",
      "Statut",
    ],
    lots.map((lot) => [
      lot.reference,
      lot.surface.toString(),
      lot.annexSurface?.toString() ?? "",
      lot.suv?.toString() ?? "",
      lot.floor ?? "",
      lot.type,
      lot.priceHT.toString(),
      lot.vatRate.toString(),
      lot.priceTTC.toString(),
      STATUS_LABEL[lot.status],
    ]),
  );

  return csvResponse(
    `equatis_lots_${slugify(programmeName)}_${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  );
}

export async function lotsPdfExport(
  programmeId: string,
  programmeName: string,
): Promise<Response> {
  // Tri naturel, identique à celui de la grille affichée (T13).
  const lots = sortByLotReference(
    await prisma.lot.findMany({ where: { programmeId } }),
    (l) => l.reference,
  );

  const pdf = generateLotsPdf(
    programmeName,
    lots.map((l) => ({
      reference: l.reference,
      surface: Number(l.surface),
      floor: l.floor,
      type: l.type,
      priceHT: Number(l.priceHT),
      vatRate: Number(l.vatRate),
      priceTTC: Number(l.priceTTC),
      status: l.status,
    })),
  );

  return pdfResponse(
    pdf,
    `equatis_lots_${slugify(programmeName)}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

export async function treasuryCsvExport(
  programmeId: string,
  programmeName: string,
): Promise<Response> {
  const entries = await prisma.tresoreriePrev.findMany({
    where: { programmeId },
    orderBy: { month: "asc" },
  });

  const csv = rowsToCsv(
    ["Mois", "Entrées (€)", "Dépenses (€)", "Solde (€)"],
    entries.map((e) => [
      monthKey(e.month),
      e.income.toString(),
      e.expense.toString(),
      (Number(e.income) - Number(e.expense)).toFixed(2),
    ]),
  );

  return csvResponse(
    `equatis_tresorerie_${slugify(programmeName)}_${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  );
}

export async function treasuryPdfExport(
  programmeId: string,
  programmeName: string,
): Promise<Response> {
  const months = rollingMonths();
  const first = months[0];
  const last = months[months.length - 1];

  const entries = await prisma.tresoreriePrev.findMany({
    where: {
      programmeId,
      ...(first && last ? { month: { gte: first, lte: last } } : {}),
    },
  });

  const byKey = new Map(entries.map((e) => [monthKey(e.month), e]));

  const data: TreasuryPdfMonth[] = months.map((d) => {
    const iso = monthKey(d);
    const entry = byKey.get(iso);
    return {
      iso,
      label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      income: entry ? Number(entry.income) : 0,
      expense: entry ? Number(entry.expense) : 0,
    };
  });

  const pdf = generateTreasuryPdf(programmeName, data);
  return pdfResponse(
    pdf,
    `equatis_tresorerie_${slugify(programmeName)}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
