import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationRow } from "@/components/notifications/notification-row";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Notifications" };

const KIND_LABEL: Record<string, string> = {
  NEW_DOCUMENT: "Nouveau document",
  DOCUMENT_REQUESTED: "Pièce demandée",
  SIGNATURE_COMPLETED: "Signature complétée",
  DOSSIER_INACTIVE: "Dossier inactif",
  NEW_LEAD: "Nouveau lead",
  TRANSMITTED_TO_NOTARY: "Transmis au notaire",
  MISSING_PIECE_REPORTED: "Pièce manquante signalée",
  NEW_MESSAGE: "Nouveau message",
  DOSSIER_ASSOCIATED: "Dossier associé",
  ACT_READY: "Acte prêt",
};

export default async function NotificationsPage() {
  const me = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread > 0
              ? `${unread} non lue${unread > 1 ? "s" : ""}`
              : "Toutes les notifications sont lues."}
          </p>
        </div>
        <MarkAllReadButton count={unread} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        {notifications.length === 0 ? (
          <EmptyState
            title="Aucune notification"
            description="Les nouvelles activités sur vos dossiers apparaîtront ici."
          />
        ) : (
          <CardContent className="px-0">
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  id={n.id}
                  title={n.title}
                  body={n.body}
                  link={n.link}
                  read={Boolean(n.readAt)}
                  createdAt={n.createdAt}
                  kindLabel={KIND_LABEL[n.kind] ?? n.kind}
                />
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
