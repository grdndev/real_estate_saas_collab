import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import {
  loadAvailablePromoters,
  loadProgrammeDetail,
} from "@/lib/programme/access";
import { parseSortDirection } from "@/lib/lot/sort";
import { ProgrammeDetailView } from "@/components/views/programmes/programme-detail-view";

export const metadata: Metadata = { title: "Détail programme" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tri?: string }>;
}

export default async function CollabProgrammeDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;
  const sortDirection = parseSortDirection((await searchParams).tri);

  const programme = await loadProgrammeDetail(id);
  if (!programme) notFound();

  const availablePromoters = await loadAvailablePromoters(
    new Set(programme.promoters.map((p) => p.promoterId)),
  );

  return (
    <ProgrammeDetailView
      programme={programme}
      availablePromoters={availablePromoters}
      basePath="/collaborateur/programmes"
      lotBasePath="/collaborateur/lots"
      fondsBasePath="/collaborateur/fonds"
      canEdit
      // L'assignation des promoteurs reste réservée au SUPER_ADMIN.
      canManagePromoters={false}
      sortDirection={sortDirection}
    />
  );
}
