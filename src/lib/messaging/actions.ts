"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import { newMessageMail } from "@/lib/mail/templates";
import { getRequestContext } from "@/lib/request-context";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";
import {
  sendDirectMessageSchema,
  type SendDirectMessageInput,
} from "@/lib/messaging/schemas";
import type { ActionResult } from "@/lib/auth/actions";

// Tous les membres internes peuvent échanger — sauf le client.
const INTERNAL_ROLES = [
  "COLLABORATOR",
  "PROMOTER",
  "NOTARY",
  "SUPER_ADMIN",
] as const;

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Envoie un message (et éventuellement un document) à un autre membre.
 * Réservé aux membres internes — le client n'a pas accès à la messagerie interne.
 */
export async function sendDirectMessageAction(
  input: SendDirectMessageInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole([...INTERNAL_ROLES]);
  const parsed = sendDirectMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  if (data.recipientId === me.id) {
    return {
      ok: false,
      error: "Impossible de s'envoyer un message à soi-même.",
    };
  }
  const ctx = await getRequestContext();

  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientId },
    select: {
      id: true,
      role: true,
      firstName: true,
      email: true,
      deletedAt: true,
    },
  });
  if (
    !recipient ||
    recipient.deletedAt ||
    !INTERNAL_ROLES.includes(recipient.role as (typeof INTERNAL_ROLES)[number])
  ) {
    return { ok: false, error: "Destinataire invalide." };
  }

  // Document joint optionnel.
  let attachmentKey: string | null = null;
  let attachmentName: string | null = null;
  if (data.attachmentB64) {
    if (!isStorageConfigured()) {
      return {
        ok: false,
        error: "Stockage non configuré — envoi du document impossible.",
      };
    }
    try {
      const buffer = Buffer.from(data.attachmentB64, "base64");
      attachmentKey = `messages/${me.id}/${randomUUID()}`;
      await putObject(attachmentKey, buffer, "application/octet-stream");
      attachmentName = data.attachmentName || "document";
    } catch {
      return { ok: false, error: "Échec de l'envoi du document." };
    }
  }

  const message = await prisma.directMessage.create({
    data: {
      senderId: me.id,
      recipientId: data.recipientId,
      body: data.body || (attachmentName ? `Document : ${attachmentName}` : ""),
      attachmentKey,
      attachmentName,
    },
  });

  await notify({
    userId: data.recipientId,
    kind: "NEW_MESSAGE",
    title: `Nouveau message de ${me.name ?? "un collègue"}`,
    body: data.body?.slice(0, 140) || `Document : ${attachmentName}`,
    link: `/messagerie-interne/${me.id}`,
  });
  try {
    await getMailer().send(
      newMessageMail(
        recipient.email,
        recipient.firstName,
        me.name ?? "un collègue",
        (data.body || `Document : ${attachmentName}`).slice(0, 200),
        `/messagerie-interne/${me.id}`,
      ),
    );
  } catch {}

  await audit({
    userId: me.id,
    action: "MESSAGE_SENT",
    resourceType: "DirectMessage",
    resourceId: message.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { recipientId: data.recipientId, hasAttachment: !!attachmentKey },
  });

  revalidatePath("/messagerie-interne");
  revalidatePath(`/messagerie-interne/${data.recipientId}`);
  return { ok: true, value: { id: message.id } };
}

/** Marque comme lus les messages reçus d'un interlocuteur. */
export async function markConversationReadAction(
  otherUserId: string,
): Promise<ActionResult> {
  const me = await requireRole([...INTERNAL_ROLES]);
  if (!otherUserId) return { ok: false, error: "Identifiant manquant" };

  await prisma.directMessage.updateMany({
    where: { senderId: otherUserId, recipientId: me.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/messagerie-interne");
  revalidatePath(`/messagerie-interne/${otherUserId}`);
  return { ok: true, value: undefined };
}
