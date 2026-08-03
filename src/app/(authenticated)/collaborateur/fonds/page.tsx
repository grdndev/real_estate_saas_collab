import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { loadFondsOverview } from "@/lib/fonds/access";
import { parseSortDirection } from "@/lib/lot/sort";
import { FondsListView } from "@/components/views/fonds/fonds-list-view";

export const metadata: Metadata = { title: "Suivi des fonds" };

interface PageProps {
  searchParams: Promise<{ programme?: string; tri?: string }>;
}

export default async function CollaborateurFondsPage({
  searchParams,
}: PageProps) {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const params = await searchParams;

  const data = await loadFondsOverview(params.programme);
  const sortDirection = parseSortDirection(params.tri);

  return (
    <FondsListView
      data={data}
      basePath="/collaborateur/fonds"
      sortDirection={sortDirection}
    />
  );
}
