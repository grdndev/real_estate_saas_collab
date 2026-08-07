import { ClientSidebar } from "@/components/client-space/client-sidebar";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);

  // Un client peut porter plusieurs dossiers actifs (un par lot acheté) : la
  // barre latérale les liste et pointe vers le dossier courant.
  const dossiers =
    me.role === "CLIENT"
      ? await prisma.dossier.findMany({
          where: { clientId: me.id, archivedAt: null },
          orderBy: { lastActivityAt: "desc" },
          select: {
            id: true,
            lot: {
              select: {
                reference: true,
                programme: { select: { name: true } },
              },
            },
            _count: {
              select: {
                messages: {
                  where: {
                    senderId: { not: me.id },
                    NOT: { readBy: { has: me.id } },
                  },
                },
              },
            },
          },
        })
      : [];

  return (
    <div className="flex flex-1">
      <ClientSidebar
        dossiers={dossiers.map((d) => ({
          id: d.id,
          label: `${d.lot.programme.name} — ${d.lot.reference}`,
          unreadMessages: d._count.messages,
        }))}
      />
      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
