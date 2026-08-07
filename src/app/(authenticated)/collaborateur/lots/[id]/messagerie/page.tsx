import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LotMessagerieView } from "@/components/views/lots/lot-messagerie-view";
import { requireRole } from "@/lib/auth/guards";
import { findLotForUser } from "@/lib/lot/access";

export const metadata: Metadata = { title: "Messagerie du lot" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LotMessageriePage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findLotForUser(id, me.role);
  if (!accessible) notFound();

  return (
    <LotMessagerieView
      lotId={id}
      currentUserId={me.id}
      basePath="/collaborateur/lots"
    />
  );
}
