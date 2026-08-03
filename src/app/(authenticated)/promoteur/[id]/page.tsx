import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeDashboard } from "@/lib/programme/access";
import { ProgrammeDashboardView } from "@/components/views/programme/programme-dashboard-view";

export const metadata: Metadata = { title: "Tableau de bord programme" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeDashboardPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;

  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const { lots, documents } = await loadProgrammeDashboard(id);

  return (
    <ProgrammeDashboardView
      programme={programme}
      lots={lots}
      documents={documents}
      basePath="/promoteur"
    />
  );
}
