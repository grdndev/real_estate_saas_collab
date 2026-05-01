import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { csvResponse, rowsToCsv } from "@/lib/csv";

const STATUS_LABEL = {
  AVAILABLE: "Disponible",
  RESERVED: "Réservé",
  SOLD: "Vendu",
  WITHDRAWN: "Retiré",
} as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await ctx.params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const lots = await prisma.lot.findMany({
    where: { programmeId: id },
    orderBy: [{ floor: "asc" }, { reference: "asc" }],
  });

  const csv = rowsToCsv(
    [
      "Référence",
      "Surface (m²)",
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
      lot.floor ?? "",
      lot.type,
      lot.priceHT.toString(),
      lot.vatRate.toString(),
      lot.priceTTC.toString(),
      STATUS_LABEL[lot.status],
    ]),
  );

  return csvResponse(
    `equatis_lots_${programme.reference}_${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  );
}
