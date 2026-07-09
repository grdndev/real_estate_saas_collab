import { ClientSidebar } from "@/components/client-space/client-sidebar";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);

  const unreadMessages =
    me.role === "CLIENT"
      ? await prisma.message.count({
          where: {
            dossier: { clientId: me.id },
            senderId: { not: me.id },
            NOT: { readBy: { has: me.id } },
          },
        })
      : 0;

  return (
    <div className="flex flex-1">
      <ClientSidebar unreadMessages={unreadMessages} />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
