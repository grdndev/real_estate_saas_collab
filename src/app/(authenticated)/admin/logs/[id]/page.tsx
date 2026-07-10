import { redirect } from "next/navigation";

// Ancienne page « journal par compte » — remplacée par la vue unifiée filtrable.
export default async function AdminUserLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/logs?vue=utilisateur&id=${id}`);
}
