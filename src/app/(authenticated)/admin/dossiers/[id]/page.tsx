import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DossierDetailView } from "@/components/views/dossiers/dossier-detail-view";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";

export const metadata: Metadata = { title: "Détail dossier" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DossierDetailPage({ params }: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  return (
    <DossierDetailView
      dossierId={id}
      currentUserId={me.id}
      basePath="/admin/dossiers"
    />
  );
}
