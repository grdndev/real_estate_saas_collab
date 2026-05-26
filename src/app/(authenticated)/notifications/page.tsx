import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
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
  APPOINTMENT_SCHEDULED: "Rendez-vous notaire",
  CONTRACT_STATUS_CHANGE: "Statut contractuel",
  OPTION_REMINDER: "Relance d'option",
  INVOICE_RECEIVED: "Facture reçue",
};

export default async function NotificationsPage() {
  const me = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread.length > 0
              ? `${unread.length} notification${unread.length > 1 ? "s" : ""} non lue${unread.length > 1 ? "s" : ""} sur ${notifications.length}`
              : `${notifications.length} notification${notifications.length > 1 ? "s" : ""} — tout est à jour`}
          </p>
        </div>
        <MarkAllReadButton count={unread.length} />
      </div>

      {/* Bandeau de synthèse */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <SummaryTile label="Total" value={notifications.length} tone="night" />
        <SummaryTile label="Non lues" value={unread.length} tone="accent" />
        <SummaryTile label="Lues" value={read.length} tone="muted" />
      </div>

      {notifications.length === 0 ? (
        <Card className="mt-6">
          <CardContent>
            <p className="py-12 text-center text-sm text-slate-500">
              Aucune notification pour le moment. Les activités sur vos dossiers
              apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {unread.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                Non lues
              </h2>
              <Card>
                <ul className="divide-y divide-slate-100">
                  {unread.map((n) => (
                    <NotificationRow
                      key={n.id}
                      id={n.id}
                      title={n.title}
                      body={n.body}
                      link={n.link}
                      read={false}
                      createdAt={n.createdAt}
                      kind={n.kind}
                      kindLabel={KIND_LABEL[n.kind] ?? n.kind}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {read.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                Plus anciennes
              </h2>
              <Card>
                <ul className="divide-y divide-slate-100">
                  {read.map((n) => (
                    <NotificationRow
                      key={n.id}
                      id={n.id}
                      title={n.title}
                      body={n.body}
                      link={n.link}
                      read
                      createdAt={n.createdAt}
                      kind={n.kind}
                      kindLabel={KIND_LABEL[n.kind] ?? n.kind}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "night" | "accent" | "muted";
}) {
  const cls =
    tone === "accent"
      ? "border-equatis-turquoise-200 bg-equatis-turquoise-50 text-equatis-turquoise-800"
      : tone === "muted"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-equatis-night-200 bg-equatis-night-50 text-equatis-night-800";
  return (
    <div className={`rounded-lg border p-3 text-center ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase">{label}</p>
    </div>
  );
}
