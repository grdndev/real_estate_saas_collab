import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { csvResponse, rowsToCsv } from "@/lib/csv";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await ctx.params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const entries = await prisma.tresoreriePrev.findMany({
    where: { programmeId: id },
    orderBy: { month: "asc" },
  });

  const csv = rowsToCsv(
    ["Mois", "Entrées (€)", "Dépenses (€)", "Solde (€)"],
    entries.map((e) => [
      `${e.month.getUTCFullYear()}-${String(e.month.getUTCMonth() + 1).padStart(2, "0")}`,
      e.income.toString(),
      e.expense.toString(),
      (Number(e.income) - Number(e.expense)).toFixed(2),
    ]),
  );

  return csvResponse(
    `equatis_tresorerie_${programme.reference}_${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  );
}
