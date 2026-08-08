import type { Metadata } from "next";

import { LotsListView } from "@/components/views/lots/lots-list-view";
import { requireRole } from "@/lib/auth/guards";
import { loadLotList } from "@/lib/lot/list-access";
import { lotFiltersSchema } from "@/lib/lot/schemas";

export const metadata: Metadata = { title: "Lots · Admin" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    lotStatus?: string;
    programmeId?: string;
    search?: string;
    associes?: string;
    tri?: string;
  }>;
}

export default async function LotListPage({ searchParams }: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const params = await searchParams;
  const filters = lotFiltersSchema.parse(params);

  // Périmètre par rôle résolu dans la route.
  const data = await loadLotList(me.role, filters);

  return <LotsListView data={data} filters={filters} basePath="/admin/lots" />;
}
