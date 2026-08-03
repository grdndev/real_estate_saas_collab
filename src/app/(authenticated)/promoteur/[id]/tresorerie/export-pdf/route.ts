import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { treasuryPdfExport } from "@/lib/programme/exports";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await ctx.params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  return treasuryPdfExport(id, programme.name);
}
