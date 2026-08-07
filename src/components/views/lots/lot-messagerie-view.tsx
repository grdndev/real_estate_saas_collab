import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageThread } from "@/components/messaging/thread";
import { prisma } from "@/lib/prisma";
import { markMessagesReadAction } from "@/lib/client-space/actions";

// Fil borné aux derniers messages (les plus anciens restent en base).
const THREAD_PAGE_SIZE = 200;

/**
 * Vue « messagerie du lot » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin (T5/T15). Le contrôle d'accès est fait par la
 * route appelante.
 *
 * La conversation appartient au DOSSIER : c'est le dossier actif du lot qui est
 * affiché. Dissocier puis réassocier le même client restitue ce même fil.
 */
interface Props {
  lotId: string;
  currentUserId: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

export async function LotMessagerieView({
  lotId,
  currentUserId,
  basePath,
}: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      dossier: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!lot) notFound();

  const dossier = lot.dossier;
  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={`${basePath}/${lotId}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au lot
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Messagerie indisponible</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Ce lot n&apos;a pas encore de client associé.
          </CardContent>
        </Card>
      </div>
    );
  }

  await markMessagesReadAction(dossier.id);

  const [totalCount, messages] = await Promise.all([
    prisma.message.count({ where: { dossierId: dossier.id } }),
    prisma.message.findMany({
      where: { dossierId: dossier.id },
      orderBy: { createdAt: "desc" },
      take: THREAD_PAGE_SIZE,
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  messages.reverse();

  const formatted = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    senderId: m.senderId,
    senderName: `${m.sender.firstName} ${m.sender.lastName}`,
    sentByEmail: m.sentByEmail,
    emailAttachmentCount: m.emailAttachmentCount,
    readByOthers: m.readBy.length > 0,
  }));

  const clientLabel = `${dossier.client.firstName} ${dossier.client.lastName}`;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <Link
          href={`${basePath}/${lotId}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au lot
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Messagerie
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Lot {lot.reference} — conversation avec <strong>{clientLabel}</strong>
          .
        </p>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          dossierId={dossier.id}
          currentUserId={currentUserId}
          messages={formatted}
          recipientLabel={clientLabel}
          canSendByEmail
          truncatedCount={Math.max(0, totalCount - messages.length)}
        />
      </Card>
    </div>
  );
}
