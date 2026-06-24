import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { MessageThread } from "@/components/messaging/thread";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { prisma } from "@/lib/prisma";
import { markMessagesReadAction } from "@/lib/client-space/actions";

export const metadata: Metadata = { title: "Messagerie notaire" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotaireMessageriePage({ params }: PageProps) {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  const { id } = await params;

  const accessible = await findDossierForUser(id, me.id, me.role);
  if (!accessible) notFound();

  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: {
      participants: {
        where: {
          role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!dossier) notFound();

  await markMessagesReadAction(dossier.id);

  const messages = await prisma.message.findMany({
    where: { dossierId: dossier.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { firstName: true, lastName: true } } },
  });

  const formatted = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    senderId: m.senderId,
    senderName: `${m.sender.firstName} ${m.sender.lastName}`,
    sentByEmail: m.sentByEmail,
    emailAttachmentCount: m.emailAttachmentCount,
  }));

  const collabs = dossier.participants
    .map((p) => `${p.user.firstName} ${p.user.lastName}`)
    .join(", ");
  const recipientLabel = collabs || "les collaborateurs";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <Link
          href={`/notaire/${id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au dossier
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Messagerie · {dossier.reference}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Conversation avec <strong>{recipientLabel}</strong>.
        </p>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          dossierId={dossier.id}
          currentUserId={me.id}
          messages={formatted}
          recipientLabel={recipientLabel}
        />
      </Card>
    </div>
  );
}
