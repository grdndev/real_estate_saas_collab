import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeSales } from "@/lib/programme/access";
import { ProgrammeVentesView } from "@/components/views/programme/programme-ventes-view";

export const metadata: Metadata = { title: "Suivi des ventes" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeSalesPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  // Le promoteur ne voit aucune identité de client (T1).
  const dossiers = await loadProgrammeSales(id, { withClientIdentity: false });

  return (
    <ProgrammeVentesView
      programme={programme}
      dossiers={dossiers}
      showClientIdentity={false}
      lotBasePath={null}
    />
  );
}
