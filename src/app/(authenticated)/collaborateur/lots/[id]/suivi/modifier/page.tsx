import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditDossierTrackingView } from "@/components/views/dossiers/edit-dossier-tracking-view";
import { requireRole } from "@/lib/auth/guards";
import { findLotForUser } from "@/lib/lot/access";

export const metadata: Metadata = { title: "Modifier le suivi" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDossierTrackingPage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findLotForUser(id, me.role);
  if (!accessible) notFound();

  return <EditDossierTrackingView lotId={id} basePath="/collaborateur/lots" />;
}
