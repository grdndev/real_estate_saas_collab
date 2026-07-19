import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageThread } from "@/components/messaging/thread";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { prisma } from "@/lib/prisma";
import { markMessagesReadAction } from "@/lib/client-space/actions";

export const metadata: Metadata = { title: "Messagerie dossier" };

// Fil borné aux derniers messages (les plus anciens restent en base).
const THREAD_PAGE_SIZE = 200;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollabMessageriePage({ params }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const { id } = await params;

  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!dossier) notFound();

  if (!dossier.clientId) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={`/collaborateur/dossiers/${id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au dossier
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Messagerie indisponible</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Le dossier n&apos;a pas encore de client associé.
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

  const clientLabel = dossier.client
    ? `${dossier.client.firstName} ${dossier.client.lastName}`
    : "le client";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <Link
          href={`/collaborateur/dossiers/${id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au dossier
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Messagerie
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Conversation avec <strong>{clientLabel}</strong>.
        </p>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          dossierId={dossier.id}
          currentUserId={me.id}
          messages={formatted}
          recipientLabel={clientLabel}
          canSendByEmail
          truncatedCount={Math.max(0, totalCount - messages.length)}
        />
      </Card>
    </div>
  );
}
