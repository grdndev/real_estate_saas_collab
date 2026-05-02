"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
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
