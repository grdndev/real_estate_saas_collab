import type { Metadata } from "next";

import { AssociatedClientFormView } from "@/components/views/clients/associated-client-form-view";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Nouveau client sans compte · Admin",
};

export default async function AdminNewAssociatedClientPage() {
  await requireRole("SUPER_ADMIN");
  return <AssociatedClientFormView basePath="/admin/clients/associes" />;
}
