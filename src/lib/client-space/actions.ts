"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import { newMessageMail } from "@/lib/mail/templates";
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

  // Notifier le client si associé.
  if (dossier.clientId) {
    await notify({
      userId: dossier.clientId,
      kind: "DOCUMENT_REQUESTED",
      title: "Nouvelle pièce à déposer",
      body: data.label,
      link: "/client/documents",
    });
  }

  revalidatePath(`/collaborateur/dossiers/${data.dossierId}`);
  revalidatePath("/client");
  return { ok: true, value: { id: created.id } };
}

export async function acceptDocumentRequestAction({
  requestId,
}: {
  requestId: string;
}): Promise<ActionResult> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const request = await prisma.documentRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return { ok: false, error: "Demande introuvable" };
  await prisma.documentRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", fulfilled: true },
  });
  revalidatePath(`/collaborateur/dossiers/${request.dossierId}`);
  revalidatePath("/client/documents");
  return { ok: true, value: undefined };
}

export async function refuseDocumentRequestAction({
  requestId,
}: {
  requestId: string;
}): Promise<ActionResult> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const request = await prisma.documentRequest.findUnique({
    where: { id: requestId },
    include: { dossier: { select: { clientId: true } } },
  });
  if (!request) return { ok: false, error: "Demande introuvable" };
  await prisma.documentRequest.update({
    where: { id: requestId },
    data: { status: "REFUSED" },
  });
  if (request.dossier.clientId) {
    await notify({
      userId: request.dossier.clientId,
      kind: "DOCUMENT_REQUESTED",
      title: "Pièce refusée",
      body: request.label,
      link: "/client/documents",
    });
  }
  revalidatePath(`/collaborateur/dossiers/${request.dossierId}`);
  revalidatePath("/client/documents");
  return { ok: true, value: undefined };
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

  const dossierId = parsed.data.dossierId;
  const preview = parsed.data.body.slice(0, 120);
  const senderName = me.name ?? "un participant";

  const dossierActors = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      clientId: true,
      notaryId: true,
      participants: {
        select: {
          userId: true,
          role: true,
          user: { select: { email: true, firstName: true } },
        },
      },
      client: { select: { email: true, firstName: true } },
    },
  });

  if (dossierActors) {
    // Client
    if (dossierActors.clientId && dossierActors.clientId !== me.id) {
      await notify({
        userId: dossierActors.clientId,
        kind: "NEW_MESSAGE",
        title: "Nouveau message",
        body: preview,
        link: "/client/messagerie",
      });
      if (dossierActors.client?.email) {
        try {
          await getMailer().send(
            newMessageMail(
              dossierActors.client.email,
              dossierActors.client.firstName,
              senderName,
              parsed.data.body.slice(0, 200),
              "/client/messagerie",
            ),
          );
        } catch {}
      }
    }

    // Collaborateurs
    for (const participant of dossierActors.participants) {
      if (
        participant.userId !== me.id &&
        (participant.role === "COLLABORATOR_PRIMARY" ||
          participant.role === "COLLABORATOR_SECONDARY")
      ) {
        await notify({
          userId: participant.userId,
          kind: "NEW_MESSAGE",
          title: "Nouveau message",
          body: preview,
          link: `/collaborateur/dossiers/${dossierId}/messagerie`,
        });
        if (participant.user.email) {
          try {
            await getMailer().send(
              newMessageMail(
                participant.user.email,
                participant.user.firstName,
                senderName,
                parsed.data.body.slice(0, 200),
                `/collaborateur/dossiers/${dossierId}/messagerie`,
              ),
            );
          } catch {}
        }
      }
    }

    // Notaire
    if (dossierActors.notaryId && dossierActors.notaryId !== me.id) {
      await notify({
        userId: dossierActors.notaryId,
        kind: "NEW_MESSAGE",
        title: "Nouveau message",
        body: preview,
        link: `/notaire/${dossierId}/messagerie`,
      });
      const notaryUser = await prisma.user.findUnique({
        where: { id: dossierActors.notaryId },
        select: { email: true, firstName: true },
      });
      if (notaryUser) {
        try {
          await getMailer().send(
            newMessageMail(
              notaryUser.email,
              notaryUser.firstName,
              senderName,
              parsed.data.body.slice(0, 200),
              `/notaire/${dossierId}/messagerie`,
            ),
          );
        } catch {}
      }
    }
  }

  revalidatePath(`/collaborateur/dossiers/${dossierId}/messagerie`);
  revalidatePath("/client/messagerie");
  revalidatePath(`/notaire/${dossierId}/messagerie`);
  return { ok: true, value: { id: message.id } };
}

export async function markMessagesReadAction(
  dossierId: string,
): Promise<ActionResult> {
  const me = await requireUser();
  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé" };

  const msgs = await prisma.message.findMany({
    where: { dossierId, senderId: { not: me.id } },
    select: { id: true },
  });
  await prisma.messageRead.createMany({
    data: msgs.map((m) => ({ messageId: m.id, userId: me.id })),
    skipDuplicates: true,
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
