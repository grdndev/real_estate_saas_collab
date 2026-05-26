import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Messagerie interne" };

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
};

const INTERNAL_ROLES = [
  "COLLABORATOR",
  "PROMOTER",
  "NOTARY",
  "SUPER_ADMIN",
] as const;

export default async function MessagerieInternePage() {
  const me = await requireRole([...INTERNAL_ROLES]);

  const [members, messages] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: [...INTERNAL_ROLES] },
        deletedAt: null,
        id: { not: me.id },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    prisma.directMessage.findMany({
      where: { OR: [{ senderId: me.id }, { recipientId: me.id }] },
      orderBy: { createdAt: "desc" },
      select: {
        senderId: true,
        recipientId: true,
        body: true,
        createdAt: true,
        readAt: true,
      },
    }),
  ]);

  // Dernier message + nombre de non-lus par interlocuteur.
  const lastByUser = new Map<string, { body: string; createdAt: Date }>();
  const unreadByUser = new Map<string, number>();
  for (const m of messages) {
    const other = m.senderId === me.id ? m.recipientId : m.senderId;
    if (!lastByUser.has(other)) {
      lastByUser.set(other, { body: m.body, createdAt: m.createdAt });
    }
    if (m.recipientId === me.id && !m.readAt) {
      unreadByUser.set(other, (unreadByUser.get(other) ?? 0) + 1);
    }
  }

  const totalUnread = Array.from(unreadByUser.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Messagerie interne
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Échangez messages et documents avec les autres membres —
          collaborateurs, promoteurs et notaires.
          {totalUnread > 0 && ` ${totalUnread} message(s) non lu(s).`}
        </p>
      </div>

      <Card className="mt-6">
        {members.length === 0 ? (
          <CardContent>
            <p className="py-8 text-center text-sm text-slate-500">
              Aucun autre membre sur la plateforme.
            </p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((u) => {
              const last = lastByUser.get(u.id);
              const unread = unreadByUser.get(u.id) ?? 0;
              const initials =
                `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
              return (
                <li key={u.id}>
                  <Link
                    href={`/messagerie-interne/${u.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <span
                      className="bg-equatis-night-700 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-equatis-night-800 truncate font-medium">
                          {u.firstName} {u.lastName}
                        </p>
                        <Badge variant="neutral">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {last ? last.body : "Aucun message échangé"}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="bg-equatis-turquoise-500 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
