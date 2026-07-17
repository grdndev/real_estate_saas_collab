import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { generateLotsPdf } from "@/lib/promoter/pdf-lots";
import { slugify } from "@/lib/utils";

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

  const pdf = generateLotsPdf(
    programme.name,
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

  const filename = `equatis_lots_${slugify(programme.name)}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
