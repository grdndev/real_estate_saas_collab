import type { Metadata } from "next";

import { AssociatedClientFormView } from "@/components/views/clients/associated-client-form-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Fiche client sans compte · Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAssociatedClientPage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  return (
    <AssociatedClientFormView
      basePath="/admin/clients/associes"
      clientId={id}
    />
  );
}
