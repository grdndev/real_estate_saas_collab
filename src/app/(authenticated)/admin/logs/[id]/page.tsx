import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";

// Ancienne page « journal par compte » — remplacée par la vue unifiée filtrable.
export default async function AdminUserLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Défense en profondeur : proxy.ts filtre déjà /admin, la garde revérifie ici.
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  redirect(`/admin/logs?vue=utilisateur&id=${id}`);
}
