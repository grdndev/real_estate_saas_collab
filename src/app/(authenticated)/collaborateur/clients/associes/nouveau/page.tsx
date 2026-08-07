import type { Metadata } from "next";

import { AssociatedClientFormView } from "@/components/views/clients/associated-client-form-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Nouveau client sans compte" };

export default async function CollabNewAssociatedClientPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  return (
    <AssociatedClientFormView basePath="/collaborateur/clients/associes" />
  );
}
