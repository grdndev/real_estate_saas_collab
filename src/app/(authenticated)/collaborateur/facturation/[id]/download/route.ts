import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { presignDownloadUrl } from "@/lib/storage/s3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN", "NOTARY"]);
  const { id } = await ctx.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { dossier: { select: { notaryId: true } } },
  });
  if (!invoice || !invoice.storageKey) {
    return new Response("Facture introuvable", { status: 404 });
  }
  // Un notaire ne peut télécharger que les factures de ses dossiers.
  if (me.role === "NOTARY" && invoice.dossier.notaryId !== me.id) {
    return new Response("Facture introuvable", { status: 404 });
  }

  const url = await presignDownloadUrl(
    invoice.storageKey,
    invoice.fileName ?? `facture-${invoice.number}.pdf`,
  );
  redirect(url);
}
