"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { encrypt } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getRequestContext } from "@/lib/request-context";
import {
  cancelDocumentRequestSchema,
  changePasswordSchema,
  requestDocumentSchema,
  sendMessageSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type RequestDocumentInput,
  type SendMessageInput,
  type UpdateProfileInput,
} from "@/lib/client-space/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// =====================================================
// DOCUMENT REQUESTS — côté Collaborateur (CDC §7.3)
// =====================================================

export async function requestDocumentAction(
  input: RequestDocumentInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = requestDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }

  const created = await prisma.documentRequest.create({
    data: {
      dossierId: data.dossierId,
      label: data.label,
      required: data.required,
    },
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "DocumentRequest",
    resourceId: created.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { dossierId: data.dossierId, label: data.label },
  });

  revalidatePath(`/collaborateur/dossiers/${data.dossierId}`);
  revalidatePath("/client");
  return { ok: true, value: { id: created.id } };
}

export async function cancelDocumentRequestAction(
  input: z.infer<typeof cancelDocumentRequestSchema>,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = cancelDocumentRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };

  const request = await prisma.documentRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { documents: { select: { id: true } } },
  });
  if (!request) return { ok: false, error: "Demande introuvable" };
  if (request.fulfilled || request.documents.length > 0) {
    return {
      ok: false,
      error: "Impossible de supprimer une pièce déjà déposée.",
    };
  }
  const dossier = await findDossierForUser(request.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé" };

  await prisma.documentRequest.delete({ where: { id: request.id } });
  revalidatePath(`/collaborateur/dossiers/${request.dossierId}`);
  revalidatePath("/client");
  return { ok: true, value: undefined };
}

// =====================================================
// MESSAGES (CDC §7.4)
// =====================================================

export async function sendMessageAction(
  input: SendMessageInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(
    parsed.data.dossierId,
    me.id,
    me.role,
  );
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }

  const message = await prisma.message.create({
    data: {
      dossierId: parsed.data.dossierId,
      senderId: me.id,
      body: parsed.data.body,
    },
  });
  await prisma.dossier.update({
    where: { id: parsed.data.dossierId },
    data: { lastActivityAt: new Date() },
  });

  await audit({
    userId: me.id,
    action: "MESSAGE_SENT",
    resourceType: "Message",
    resourceId: message.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: {
      dossierId: parsed.data.dossierId,
      length: parsed.data.body.length,
    },
  });

  revalidatePath(`/collaborateur/dossiers/${parsed.data.dossierId}/messagerie`);
  revalidatePath("/client/messagerie");
  return { ok: true, value: { id: message.id } };
}

export async function markMessagesReadAction(
  dossierId: string,
): Promise<ActionResult> {
  const me = await requireUser();
  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé" };

  await prisma.message.updateMany({
    where: { dossierId, readAt: null, senderId: { not: me.id } },
    data: { readAt: new Date() },
  });
  return { ok: true, value: undefined };
}

// =====================================================
// PROFIL CLIENT (CDC §7.5)
// =====================================================

export async function updateClientProfileAction(
  input: UpdateProfileInput,
): Promise<ActionResult> {
  const me = await requireUser();
  if (me.role !== "CLIENT") {
    return { ok: false, error: "Réservé aux clients." };
  }
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  await prisma.user.update({
    where: { id: me.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phoneEnc: encrypt(data.phone),
      addressEnc: encrypt(
        JSON.stringify({
          line: data.addressLine,
          postalCode: data.postalCode,
          city: data.city,
          country: data.country,
        }),
      ),
    },
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: me.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { fields: ["firstName", "lastName", "phone", "address"] },
  });

  revalidatePath("/profil");
  return { ok: true, value: undefined };
}

export async function changeClientPasswordAction(
  input: ChangePasswordInput,
): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return { ok: false, error: "Utilisateur introuvable" };

  const ok = await verifyPassword(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!ok) {
    return {
      ok: false,
      error: "Mot de passe actuel incorrect.",
      fieldErrors: { currentPassword: ["Mot de passe actuel incorrect"] },
    };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: newHash },
  });
  // Révoque les autres sessions actives.
  await prisma.session.updateMany({
    where: { userId: me.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({
    userId: me.id,
    action: "USER_PASSWORD_CHANGED",
    resourceType: "User",
    resourceId: me.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { step: "self_change" },
  });
  return { ok: true, value: undefined };
}

export async function requestAccountDeletionAction(): Promise<ActionResult> {
  const me = await requireUser();
  const ctx = await getRequestContext();

  await prisma.user.update({
    where: { id: me.id },
    data: { status: "DELETION_REQUESTED" },
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: me.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { transition: "→DELETION_REQUESTED", step: "rgpd_request" },
  });
  revalidatePath("/profil");
  return { ok: true, value: undefined };
}
