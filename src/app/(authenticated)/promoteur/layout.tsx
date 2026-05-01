import { PromoterSidebar } from "@/components/promoter/promoter-sidebar";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function PromoteurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  const programmes =
    me.role === "SUPER_ADMIN"
      ? await prisma.programme.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, reference: true },
          orderBy: { name: "asc" },
        })
      : await prisma.programme.findMany({
          where: {
            status: "ACTIVE",
            promoters: { some: { promoterId: me.id } },
          },
          select: { id: true, name: true, reference: true },
          orderBy: { name: "asc" },
        });

  return (
    <div className="flex flex-1">
      <PromoterSidebar programmes={programmes} />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
