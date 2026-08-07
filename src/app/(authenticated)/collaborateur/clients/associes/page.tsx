import type { Metadata } from "next";

import { AssociatedClientsView } from "@/components/views/clients/associated-clients-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Clients sans compte" };

export default async function CollabAssociatedClientsPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  return (
    <AssociatedClientsView
      basePath="/collaborateur/clients/associes"
      lotsPath="/collaborateur/lots"
    />
  );
}
