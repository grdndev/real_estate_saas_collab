import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditLotView } from "@/components/views/lots/edit-lot-view";
import { requireRole } from "@/lib/auth/guards";
import { findLotForUser } from "@/lib/lot/access";

export const metadata: Metadata = { title: "Modifier le lot · Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLotPage({ params }: PageProps) {
  const me = await requireRole("SUPER_ADMIN");
  const { id } = await params;

  // Contrôle d'accès dans la route : la vue ne décide d'aucun filtrage.
  const accessible = await findLotForUser(id, me.role);
  if (!accessible) notFound();

  return <EditLotView lotId={id} basePath="/admin/lots" />;
}
