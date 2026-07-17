import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { CollabSidebar } from "@/components/collab/collab-sidebar";
import { requireRole } from "@/lib/auth/guards";

export default async function CollaborateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  return (
    <div className="flex flex-1">
      {me.role === "SUPER_ADMIN" ? <AdminSidebar /> : <CollabSidebar />}
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
