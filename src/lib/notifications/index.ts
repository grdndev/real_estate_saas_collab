import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@/generated/prisma/enums";

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Crée une notification in-app. Échec silencieux pour ne pas bloquer
 *  l'action métier (les notifications sont best-effort). */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (err) {
    console.error("[notifications] échec création", err);
  }
}

/**
 * Notifie tous les acteurs d'un dossier sauf un user à exclure :
 * collaborateurs participants, client, notaire ET promoteurs du programme.
 * Plateforme collaborative — partage total de l'information (CDC évolution §5).
 */
export async function notifyDossierParticipants(
  dossierId: string,
  excludeUserId: string | null,
  kind: NotificationKind,
  title: string,
  body?: string | null,
  link?: string | null,
): Promise<void> {
  const participants = await prisma.dossierParticipant.findMany({
    where: { dossierId },
    select: { userId: true },
  });
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { clientId: true, notaryId: true, programmeId: true },
  });
  const userIds = new Set<string>(participants.map((p) => p.userId));
  if (dossier?.clientId) userIds.add(dossier.clientId);
  if (dossier?.notaryId) userIds.add(dossier.notaryId);
  if (dossier?.programmeId) {
    const promoters = await prisma.programmePromoter.findMany({
      where: { programmeId: dossier.programmeId },
      select: { promoterId: true },
    });
    for (const p of promoters) userIds.add(p.promoterId);
  }
  if (excludeUserId) userIds.delete(excludeUserId);
  await Promise.all(
    Array.from(userIds).map((uid) =>
      notify({ userId: uid, kind, title, body, link }),
    ),
  );
}
