import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeLots } from "@/lib/programme/access";
import { parseSortDirection } from "@/lib/lot/sort";
import { ProgrammeLotsView } from "@/components/views/programme/programme-lots-view";

export const metadata: Metadata = { title: "Grille des lots · Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tri?: string }>;
}

export default async function AdminProgrammeLotsPage({
  params,
  searchParams,
}: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const sortDirection = parseSortDirection((await searchParams).tri);

  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const lots = await loadProgrammeLots(id);

  return (
    <ProgrammeLotsView
      programme={programme}
      lots={lots}
      basePath="/admin/suivi"
      canCreateLot
      sortDirection={sortDirection}
    />
  );
}
