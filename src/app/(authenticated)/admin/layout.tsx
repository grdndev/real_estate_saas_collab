import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("SUPER_ADMIN");

  // Sélecteur de programme de la section « Suivi de programme » (T3).
  const programmes = await prisma.programme.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-1">
      <AdminSidebar programmes={programmes} />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
