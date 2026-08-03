import type { Metadata } from "next";

import { DossiersListView } from "@/components/views/dossiers/dossiers-list-view";
import { requireRole } from "@/lib/auth/guards";
import { loadDossierList } from "@/lib/dossier/list-access";
import { dossierFiltersSchema } from "@/lib/dossier/schemas";

export const metadata: Metadata = { title: "Dossiers" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    programmeId?: string;
    search?: string;
    page?: string;
    archives?: string;
  }>;
}

export default async function DossierListPage({ searchParams }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const params = await searchParams;
  const filters = dossierFiltersSchema.parse(params);

  // Périmètre par rôle résolu dans la route.
  const data = await loadDossierList(me.id, me.role, filters);

  return (
    <DossiersListView
      data={data}
      filters={filters}
      basePath="/collaborateur/dossiers"
    />
  );
}
