import { ClientSidebar } from "@/components/client-space/client-sidebar";
import { requireRole } from "@/lib/auth/guards";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["CLIENT", "SUPER_ADMIN"]);
  return (
    <div className="flex flex-1">
      <ClientSidebar />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
