import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { loadProgrammeTreasury, rollingMonths } from "@/lib/programme/access";
import { ProgrammeTresorerieView } from "@/components/views/programme/programme-tresorerie-view";

export const metadata: Metadata = { title: "Trésorerie prévisionnelle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeTreasuryPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const months = rollingMonths();
  const [entries, lots] = await loadProgrammeTreasury(id, months);

  return (
    <ProgrammeTresorerieView
      programme={programme}
      months={months}
      entries={entries}
      lots={lots}
      basePath="/promoteur"
    />
  );
}
