import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const SHORT_MONTHS = [
  "jan.",
  "fév.",
  "mar.",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sep.",
  "oct.",
  "nov.",
  "déc.",
];

// jsPDF embarque Helvetica (latin-1) : l'espace fine insécable de fr-FR
// s'affiche incorrectement. On utilise un séparateur espace ASCII standard.
const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEur(value: number): string {
  return eur.format(value).replace(/[\u202f\u00a0]/gu, " ");
}

export interface TreasuryPdfMonth {
  iso: string; // "2026-01"
  label: string; // "janvier 2026"
  income: number;
  expense: number;
}

export function generateTreasuryPdf(
  programmeName: string,
  months: TreasuryPdfMonth[],
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const ML = 15; // left margin
  const MR = 15; // right margin
  const PW = 210 - ML - MR; // content width = 180mm

  // ── Header ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // equatis-night-900
  doc.text("Trésorerie prévisionnelle", ML, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(programmeName, ML, 30);
  doc.text(
    `Exporté le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`,
    ML,
    36,
  );

  // ── Graphique ─────────────────────────────────────────────
  const CX = ML + 18; // chart x start (space for Y labels)
  const CY = 46; // chart y start
  const CW = PW - 18; // chart width
  const CH = 58; // chart height
  const CB = CY + CH; // chart bottom baseline

  const maxVal = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  // Round up to a nice number for the Y scale
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const yMax = Math.ceil(maxVal / magnitude) * magnitude;

  // Y-axis gridlines + labels (5 levels)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  const Y_STEPS = 4;
  for (let i = 0; i <= Y_STEPS; i++) {
    const val = (yMax / Y_STEPS) * i;
    const y = CB - (val / yMax) * CH;
    doc.line(CX, y, CX + CW, y);
    const label = val === 0 ? "0" : `${Math.round(val / 1000)}k`;
    doc.text(label, CX - 2, y + 1, { align: "right" });
  }

  // Bars
  const groupW = CW / months.length;
  const barW = groupW * 0.3;
  const gap = groupW * 0.06;

  months.forEach((m, i) => {
    const gx = CX + i * groupW;

    // Income bar — green
    const ih = (m.income / yMax) * CH;
    doc.setFillColor(22, 163, 74);
    if (ih > 0) doc.rect(gx + gap, CB - ih, barW, ih, "F");

    // Expense bar — red
    const eh = (m.expense / yMax) * CH;
    doc.setFillColor(220, 38, 38);
    if (eh > 0) doc.rect(gx + gap + barW + gap, CB - eh, barW, eh, "F");

    // X label
    const d = new Date(`${m.iso}-01`);
    const shortLabel = SHORT_MONTHS[d.getUTCMonth()] ?? "";
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(shortLabel, gx + groupW / 2, CB + 4, { align: "center" });
  });

  // X baseline
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(CX, CB, CX + CW, CB);

  // Legend
  const LY = CB + 9;
  doc.setFillColor(22, 163, 74);
  doc.rect(CX, LY - 2.5, 4, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Entrées", CX + 5.5, LY);

  doc.setFillColor(220, 38, 38);
  doc.rect(CX + 28, LY - 2.5, 4, 3, "F");
  doc.text("Dépenses", CX + 33.5, LY);

  // ── Tableau ───────────────────────────────────────────────
  let totalIncome = 0;
  let totalExpense = 0;
  for (const m of months) {
    totalIncome += m.income;
    totalExpense += m.expense;
  }
  const totalSolde = totalIncome - totalExpense;

  autoTable(doc, {
    startY: LY + 6,
    head: [["Mois", "Entrées", "Dépenses", "Solde"]],
    body: months.map((m) => [
      m.label,
      formatEur(m.income),
      formatEur(m.expense),
      formatEur(m.income - m.expense),
    ]),
    foot: [
      [
        "Total",
        formatEur(totalIncome),
        formatEur(totalExpense),
        formatEur(totalSolde),
      ],
    ],
    margin: { left: ML, right: MR },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      halign: "right",
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
