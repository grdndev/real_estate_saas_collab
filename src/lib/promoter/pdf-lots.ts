import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEur(value: number): string {
  return eur.format(value).replace(/[\u202f\u00a0]/gu, " ");
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible",
  OPTIONED: "Optionné",
  RESERVED: "Réservé",
  SOLD: "Vendu",
  WITHDRAWN: "Retiré",
};

export interface LotPdfRow {
  reference: string;
  surface: number;
  floor: number | null;
  type: string;
  priceHT: number;
  vatRate: number;
  priceTTC: number;
  status: string;
}

export function generateLotsPdf(
  programmeName: string,
  lots: LotPdfRow[],
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  const ML = 15;
  const MR = 15;

  // ── Header ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("Grille des lots", ML, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(programmeName, ML, 30);
  doc.text(
    `${lots.length} lot${lots.length > 1 ? "s" : ""} · Exporté le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`,
    ML,
    36,
  );

  // ── Tableau ───────────────────────────────────────────────
  autoTable(doc, {
    startY: 44,
    head: [
      [
        "Référence",
        "Surface (m²)",
        "Étage",
        "Type",
        "Prix HT",
        "TVA",
        "Prix TTC",
        "Statut",
      ],
    ],
    body: lots.map((lot) => [
      lot.reference,
      `${lot.surface} m²`,
      lot.floor ?? "—",
      lot.type,
      formatEur(lot.priceHT),
      `${lot.vatRate} %`,
      formatEur(lot.priceTTC),
      STATUS_LABEL[lot.status] ?? lot.status,
    ]),
    margin: { left: ML, right: MR },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 28 },
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "left" },
      4: { halign: "right", cellWidth: 32 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 32 },
      7: { halign: "left", cellWidth: 26 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
