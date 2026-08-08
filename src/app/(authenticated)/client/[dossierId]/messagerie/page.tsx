import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { MessageThread } from "@/components/messaging/thread";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { prisma } from "@/lib/prisma";
import { markMessagesReadAction } from "@/lib/client-space/actions";
import { loadThreadPage } from "@/lib/messaging/thread-page";

export const metadata: Metadata = { title: "Messagerie" };

interface PageProps {
  params: Promise<{ dossierId: string }>;
}

export default async function ClientMessageriePage({ params }: PageProps) {
  const me = await requireRole(["CLIENT"]);
  const { dossierId } = await params;

  // Contrôle d'accès dans la route : le client ne voit que ses dossiers actifs.
  const accessible = await findDossierForUser(dossierId, me.id, me.role);
  if (!accessible) notFound();

  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    include: {
      lot: { select: { reference: true } },
      participants: {
        where: { role: "COLLABORATOR_PRIMARY" },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const referent = dossier.participants[0]?.user;
  const referentLabel = referent
    ? `${referent.firstName} ${referent.lastName}`
    : "votre collaborateur référent";

  // Marque comme lus les messages reçus.
  await markMessagesReadAction(dossier.id);

  // Fin de la conversation ; les messages plus anciens remontent au scroll.
  const thread = await loadThreadPage(dossier.id, null);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Messagerie
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Lot {dossier.lot.reference} — conversation avec{" "}
          <strong>{referentLabel}</strong>.
        </p>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <MessageThread
          dossierId={dossier.id}
          currentUserId={me.id}
          messages={thread.rows}
          recipientLabel={referentLabel}
          olderCursor={thread.nextCursor}
        />
      </Card>
    </div>
  );
}
