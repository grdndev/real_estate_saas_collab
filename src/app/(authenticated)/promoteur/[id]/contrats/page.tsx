import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeContracts } from "@/lib/programme/access";
import { ProgrammeContratsView } from "@/components/views/programme/programme-contrats-view";

export const metadata: Metadata = { title: "Suivi des contrats" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeContractsPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  // Le promoteur ne voit aucune identité de client (T1).
  const dossiers = await loadProgrammeContracts(id, {
    withClientIdentity: false,
  });

  return (
    <ProgrammeContratsView
      programme={programme}
      dossiers={dossiers}
      showClientIdentity={false}
      lotBasePath={null}
    />
  );
}
