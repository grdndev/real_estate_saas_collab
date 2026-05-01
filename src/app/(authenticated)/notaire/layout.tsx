import { NotarySidebar } from "@/components/notary/notary-sidebar";
import { requireRole } from "@/lib/auth/guards";

export default async function NotaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["NOTARY", "SUPER_ADMIN"]);
  return (
    <div className="flex flex-1">
      <NotarySidebar />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
