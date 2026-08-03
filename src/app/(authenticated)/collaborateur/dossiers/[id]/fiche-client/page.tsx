import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DossierFicheClientView } from "@/components/views/dossiers/dossier-fiche-client-view";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";

export const metadata: Metadata = { title: "Fiche client" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DossierFicheClientPage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  return (
    <DossierFicheClientView dossierId={id} basePath="/collaborateur/dossiers" />
  );
}
