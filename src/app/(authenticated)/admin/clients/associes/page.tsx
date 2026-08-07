import type { Metadata } from "next";

import { AssociatedClientsView } from "@/components/views/clients/associated-clients-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Clients sans compte · Admin" };

export default async function AdminAssociatedClientsPage() {
  await requireRole("SUPER_ADMIN");
  return (
    <AssociatedClientsView
      basePath="/admin/clients/associes"
      lotsPath="/admin/lots"
    />
  );
}
