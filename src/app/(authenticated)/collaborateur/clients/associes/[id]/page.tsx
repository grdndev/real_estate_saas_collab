import type { Metadata } from "next";

import { AssociatedClientFormView } from "@/components/views/clients/associated-client-form-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Fiche client sans compte" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollabAssociatedClientPage({
  params,
}: PageProps) {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;
  return (
    <AssociatedClientFormView
      basePath="/collaborateur/clients/associes"
      clientId={id}
    />
  );
}
