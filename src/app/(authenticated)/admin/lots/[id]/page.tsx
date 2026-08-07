import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LotDetailView } from "@/components/views/lots/lot-detail-view";
import { requireRole } from "@/lib/auth/guards";
import { findLotForUser } from "@/lib/lot/access";

export const metadata: Metadata = { title: "Détail lot · Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LotDetailPage({ params }: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findLotForUser(id, me.role);
  if (!accessible) notFound();

  return (
    <LotDetailView lotId={id} currentUserId={me.id} basePath="/admin/lots" />
  );
}
