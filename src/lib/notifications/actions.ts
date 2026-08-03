"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import {
  loadReadNotificationsPage,
  type NotificationRowData,
} from "@/lib/notifications/list";
import type { ActionResult } from "@/lib/auth/actions";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  const me = await requireUser();
  if (!notificationId) return { ok: false, error: "Identifiant manquant" };
  const note = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!note || note.userId !== me.id) {
    return { ok: false, error: "Accès refusé" };
  }
  if (!note.readAt) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }
  revalidatePath("/notifications");
  return { ok: true, value: undefined };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const me = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: me.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true, value: undefined };
}

/**
 * Page suivante des notifications lues (T14 — scroll infini).
 *
 * Le périmètre est recalculé à partir de la session : un curseur ne peut pas
 * servir à lire les notifications d'un autre utilisateur.
 */
export async function loadMoreNotificationsAction(
  cursor: string | null,
): Promise<
  ActionResult<{ rows: NotificationRowData[]; nextCursor: string | null }>
> {
  const me = await requireUser();
  const page = await loadReadNotificationsPage(me.id, cursor);
  return { ok: true, value: page };
}
