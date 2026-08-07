import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeContracts } from "@/lib/programme/access";
import { ProgrammeContratsView } from "@/components/views/programme/programme-contrats-view";

export const metadata: Metadata = { title: "Suivi des contrats · Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProgrammeContractsPage({
  params,
}: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  // Contrairement au promoteur, l'admin conserve l'identité du client (T3).
  const dossiers = await loadProgrammeContracts(id, {
    withClientIdentity: true,
  });

  return (
    <ProgrammeContratsView
      programme={programme}
      dossiers={dossiers}
      showClientIdentity
      lotBasePath="/admin/lots"
    />
  );
}
