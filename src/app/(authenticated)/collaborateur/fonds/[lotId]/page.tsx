import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { loadLotFondsDetail } from "@/lib/fonds/access";
import { FondsDetailView } from "@/components/views/fonds/fonds-detail-view";

interface PageProps {
  params: Promise<{ lotId: string }>;
}

export const metadata: Metadata = { title: "Détail fonds" };

export default async function LotFondsDetailPage({ params }: PageProps) {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { lotId } = await params;

  const lot = await loadLotFondsDetail(lotId);
  if (!lot) notFound();

  const notaries = await prisma.user.findMany({
    where: { role: "NOTARY", status: "ACTIVE", deletedAt: null },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const now = new Date();
  const programmeAppelTypes = (
    await prisma.appelFonds.findMany({
      where: { programmeId: lot.programmeId },
      orderBy: { numero: "asc" },
    })
  ).map((a) => ({
    id: a.id,
    numero: a.numero,
    label: a.label,
    pourcentage: Number(a.pourcentage),
    datePrevue: a.datePrevue.toISOString(),
    debloque: a.datePrevue <= now,
  }));

  return (
    <FondsDetailView
      lot={lot}
      dossierBasePath="/collaborateur/dossiers"
      notaries={notaries}
      programmeAppelTypes={programmeAppelTypes}
    />
  );
}
