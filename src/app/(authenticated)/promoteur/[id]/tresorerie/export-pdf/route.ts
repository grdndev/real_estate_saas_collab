import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { generateTreasuryPdf } from "@/lib/promoter/pdf-treasury";
import type { TreasuryPdfMonth } from "@/lib/promoter/pdf-treasury";

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await ctx.params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const today = new Date();
  const startMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(startMonth);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d;
  });

  const entries = await prisma.tresoreriePrev.findMany({
    where: {
      programmeId: id,
      month: { gte: months[0], lte: months[months.length - 1] },
    },
  });

  const byKey = new Map(
    entries.map((e) => [
      `${e.month.getUTCFullYear()}-${String(e.month.getUTCMonth() + 1).padStart(2, "0")}`,
      e,
    ]),
  );

  const data: TreasuryPdfMonth[] = months.map((d) => {
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = byKey.get(iso);
    return {
      iso,
      label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      income: entry ? Number(entry.income) : 0,
      expense: entry ? Number(entry.expense) : 0,
    };
  });

  const pdf = generateTreasuryPdf(programme.name, programme.reference, data);
  const filename = `equatis_tresorerie_${programme.reference}_${today.toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
