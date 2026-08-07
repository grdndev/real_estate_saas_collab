import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LotFicheClientView } from "@/components/views/lots/lot-fiche-client-view";
import { requireRole } from "@/lib/auth/guards";
import { findLotForUser } from "@/lib/lot/access";

export const metadata: Metadata = { title: "Fiche client" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LotFicheClientPage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findLotForUser(id, me.role);
  if (!accessible) notFound();

  return <LotFicheClientView lotId={id} basePath="/collaborateur/lots" />;
}
