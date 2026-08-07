"use server";

import { revalidatePath } from "next/cache";

import {
  collaboratorLotPath,
  revalidateDossierPaths,
  revalidateLotPaths,
} from "@/lib/lot/revalidate";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canBeContactedByEmail } from "@/lib/user/no-account";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import {
  newMessageMail,
  messageByEmailMail,
  documentDeclinedMail,
} from "@/lib/mail/templates";
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
import { FAMILY_STATUS_LABEL } from "../client-profile/schemas";
import { type FamilyStatus } from "@/generated/prisma/enums";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
    metadata: `Demande de document « ${data.label} » créée (dossier ${data.dossierId})`,
  });

  // Notifier le client si associé.
  if (dossier.clientId) {
    await notify({
      userId: dossier.clientId,
      kind: "DOCUMENT_REQUESTED",
      title: "Nouvelle pièce à déposer",
      body: data.label,
      link: `/client/${data.dossierId}/documents`,
    });
  }

  await revalidateDossierPaths(data.dossierId);
  revalidatePath(`/client/${data.dossierId}`);
  return { ok: true, value: { id: created.id } };
}

export async function acceptDocumentAction({
  documentId,
}: {
  documentId: string;
}): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document || document.deletedAt) {
    return { ok: false, error: "Document introuvable" };
  }
  if (!document.dossierId) return { ok: false, error: "Accès refusé." };
  const dossier = await findDossierForUser(document.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé." };

  await prisma.document.update({
    where: { id: document.id },
    data: { reviewStatus: "ACCEPTED", reviewReason: null },
  });
  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_REQUEST_UPDATED",
    resourceType: "Document",
    resourceId: document.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Document « ${document.fileName} » accepté (dossier ${document.dossierId})`,
  });
  if (document.dossierId) {
    await revalidateDossierPaths(document.dossierId);
    revalidatePath(`/client/${document.dossierId}/documents`);
  }
  return { ok: true, value: undefined };
}

export async function refuseDocumentAction({
  documentId,
  reason,
}: {
  documentId: string;
  reason: string;
}): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Motif de refus requis (3 caractères min)." };
  }
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      dossier: {
        select: {
          client: { select: { id: true, email: true, status: true } },
        },
      },
    },
  });
  if (!document || document.deletedAt) {
    return { ok: false, error: "Document introuvable" };
  }
  if (!document.dossierId) return { ok: false, error: "Accès refusé." };
  const dossier = await findDossierForUser(document.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé." };

  await prisma.document.update({
    where: { id: document.id },
    data: { reviewStatus: "REFUSED", reviewReason: trimmed },
  });
  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_REQUEST_UPDATED",
    resourceType: "Document",
    resourceId: document.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Document « ${document.fileName} » refusé (dossier ${document.dossierId} - Raison : ${trimmed})`,
  });

  if (document.dossier?.client) {
    await notify({
      userId: document.dossier.client.id,
      kind: "DOCUMENT_REQUESTED",
      title: "Document refusé",
      body: document.fileName,
      link: `/client/${document.dossierId}/documents`,
    });

    // Un client sans compte (T7) n'a pas d'adresse exploitable : seule la
    // notification in-app est conservée.
    if (canBeContactedByEmail(document.dossier.client)) {
      getMailer().send(
        documentDeclinedMail(
          document.dossier.client.email,
          document.fileName,
          trimmed,
        ),
      );
    }
  }

  if (document.dossierId) {
    await revalidateDossierPaths(document.dossierId);
    revalidatePath(`/client/${document.dossierId}/documents`);
  }
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
  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_REQUEST_UPDATED",
    resourceType: "DocumentRequest",
    resourceId: request.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Demande de pièce « ${request.label} » annulée (dossier ${request.dossierId})`,
  });
  await revalidateDossierPaths(request.dossierId);
  revalidatePath(`/client/${request.dossierId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// MESSAGES (CDC §7.4)
// Conversation à deux parties : le client et les collaborateurs du dossier.
// =====================================================

const MESSAGING_ROLES = ["CLIENT", "COLLABORATOR", "SUPER_ADMIN"] as const;

const MAX_EMAIL_ATTACHMENTS = 5;
const MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024; // 10 Mo (limite Brevo)

interface MessageRecipient {
  userId: string;
  email: string | null;
  firstName: string;
  link: string;
}

/** Notifications in-app + e-mails aux destinataires, en parallèle et best-effort. */
async function notifyMessageRecipients(
  recipients: MessageRecipient[],
  senderName: string,
  preview: string,
): Promise<void> {
  await Promise.allSettled(
    recipients.flatMap((r) => {
      const tasks: Promise<unknown>[] = [
        notify({
          userId: r.userId,
          kind: "NEW_MESSAGE",
          title: "Nouveau message",
          body: preview.slice(0, 120),
          link: r.link,
        }),
      ];
      if (r.email) {
        tasks.push(
          getMailer().send(
            newMessageMail(
              r.email,
              r.firstName,
              senderName,
              preview.slice(0, 200),
              r.link,
            ),
          ),
        );
      }
      return tasks;
    }),
  );
}

interface DossierMessageActors {
  /** Lot du dossier — clé d'URL des écrans internes. */
  lotId: string;
  clientId: string | null;
  client: { email: string; firstName: string } | null;
  participants: Array<{
    userId: string;
    role: string;
    user: { email: string; firstName: string };
  }>;
}

/** Destinataires d'un message : client + collaborateurs du dossier, sauf l'expéditeur. */
function messageRecipients(
  actors: DossierMessageActors,
  dossierId: string,
  senderId: string,
): MessageRecipient[] {
  const recipients: MessageRecipient[] = [];
  if (actors.clientId && actors.clientId !== senderId) {
    recipients.push({
      userId: actors.clientId,
      email: actors.client?.email ?? null,
      firstName: actors.client?.firstName ?? "",
      link: `/client/${dossierId}/messagerie`,
    });
  }
  for (const participant of actors.participants) {
    if (
      participant.userId !== senderId &&
      (participant.role === "COLLABORATOR_PRIMARY" ||
        participant.role === "COLLABORATOR_SECONDARY")
    ) {
      recipients.push({
        userId: participant.userId,
        email: participant.user.email,
        firstName: participant.user.firstName,
        link: collaboratorLotPath(actors.lotId, "/messagerie"),
      });
    }
  }
  return recipients;
}

const dossierMessageActorsSelect = {
  clientId: true,
  lotId: true,
  client: { select: { email: true, firstName: true, status: true } },
  participants: {
    select: {
      userId: true,
      role: true,
      user: { select: { email: true, firstName: true } },
    },
  },
} as const;

export async function sendMessageAction(
  input: SendMessageInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole([...MESSAGING_ROLES]);
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
  if (!dossier.clientId) {
    return {
      ok: false,
      error: "Le dossier n'a pas encore de client associé.",
    };
  }

  const dossierId = parsed.data.dossierId;
  const message = await prisma.message.create({
    data: {
      dossierId,
      senderId: me.id,
      body: parsed.data.body,
    },
  });
  const actors = await prisma.dossier.update({
    where: { id: dossierId },
    data: { lastActivityAt: new Date() },
    select: dossierMessageActorsSelect,
  });

  await audit({
    userId: me.id,
    action: "MESSAGE_SENT",
    resourceType: "Message",
    resourceId: message.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Message envoyé sur le dossier ${dossierId} (${parsed.data.body.length} caractères)`,
  });

  await notifyMessageRecipients(
    messageRecipients(actors, dossierId, me.id),
    me.name ?? "un participant",
    parsed.data.body,
  );

  revalidateLotPaths(actors.lotId, "/messagerie");
  revalidatePath(`/client/${dossierId}/messagerie`);
  return { ok: true, value: { id: message.id } };
}

export async function sendMessageByEmailAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const dossierId = formData.get("dossierId");
  const body = formData.get("body");

  if (!dossierId || typeof dossierId !== "string" || !dossierId.trim()) {
    return { ok: false, error: "Dossier invalide." };
  }
  if (typeof body !== "string") {
    return { ok: false, error: "Saisie invalide" };
  }
  const trimmed = body.trim();
  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (trimmed.length === 0 && files.length === 0) {
    return {
      ok: false,
      error: "Saisissez un message ou joignez au moins un fichier.",
    };
  }
  if (trimmed.length > 4000) {
    return {
      ok: false,
      error: "Le message doit contenir au plus 4000 caractères.",
    };
  }
  if (files.length > MAX_EMAIL_ATTACHMENTS) {
    return {
      ok: false,
      error: `Au plus ${MAX_EMAIL_ATTACHMENTS} pièces jointes par envoi.`,
    };
  }
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
    return {
      ok: false,
      error: "Les pièces jointes dépassent 10 Mo au total.",
    };
  }

  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }

  const actors = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: dossierMessageActorsSelect,
  });
  if (!actors?.clientId || !actors.client?.email) {
    return {
      ok: false,
      error: "Le dossier n'a pas de client avec e-mail — envoi impossible.",
    };
  }
  // Un client associé sans compte n'a ni messagerie ni email (T7).
  if (!canBeContactedByEmail(actors.client)) {
    return {
      ok: false,
      error:
        "Ce client est un client associé sans compte : la messagerie ne lui est pas accessible.",
    };
  }

  const senderName = me.name ?? "un collaborateur";

  // L'e-mail au client est le canal principal : on n'enregistre le message
  // qu'une fois son envoi confirmé.
  try {
    const attachments = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        content: Buffer.from(await f.arrayBuffer()).toString("base64"),
      })),
    );
    await getMailer().send({
      ...messageByEmailMail(
        actors.client.email,
        actors.client.firstName,
        senderName,
        trimmed,
        files.length,
      ),
      attachments,
    });
  } catch {
    return {
      ok: false,
      error:
        "L'envoi de l'e-mail au client a échoué. Le message n'a pas été enregistré, veuillez réessayer.",
    };
  }

  const message = await prisma.message.create({
    data: {
      dossierId,
      senderId: me.id,
      body: trimmed,
      sentByEmail: true,
      emailAttachmentCount: files.length,
    },
  });
  await prisma.dossier.update({
    where: { id: dossierId },
    data: { lastActivityAt: new Date() },
  });

  await audit({
    userId: me.id,
    action: "MESSAGE_SENT",
    resourceType: "Message",
    resourceId: message.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Message envoyé par email sur le dossier ${dossierId} (${files.length} pièce(s) jointe(s))`,
  });

  const preview =
    trimmed || `${files.length} pièce(s) jointe(s) envoyée(s) par e-mail`;

  // Le client a déjà reçu l'e-mail : notification in-app seulement pour lui,
  // notification + e-mail pour les autres collaborateurs.
  const recipients = messageRecipients(actors, dossierId, me.id);
  await Promise.allSettled([
    ...(actors.clientId !== me.id
      ? [
          notify({
            userId: actors.clientId,
            kind: "NEW_MESSAGE",
            title: "Nouveau message",
            body: preview.slice(0, 120),
            link: `/client/${dossierId}/messagerie`,
          }),
        ]
      : []),
    notifyMessageRecipients(
      recipients.filter((r) => r.userId !== actors.clientId),
      senderName,
      preview,
    ),
  ]);

  revalidateLotPaths(actors.lotId, "/messagerie");
  revalidatePath(`/client/${dossierId}/messagerie`);
  return { ok: true, value: { id: message.id } };
}

export async function markMessagesReadAction(
  dossierId: string,
): Promise<ActionResult> {
  const me = await requireRole([...MESSAGING_ROLES]);
  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Accès refusé" };

  await prisma.message.updateMany({
    where: {
      dossierId,
      senderId: { not: me.id },
      NOT: { readBy: { has: me.id } },
    },
    data: { readBy: { push: me.id } },
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
  const familyStatus =
    data.familyStatus && data.familyStatus in FAMILY_STATUS_LABEL
      ? (data.familyStatus as FamilyStatus)
      : null;

  const profileData = {
    birthName: data.birthName || null,
    birthDate: parseDate(data.birthDate ?? ""),
    birthPlace: data.birthPlace || null,
    profession: data.profession || null,
    nationality: data.nationality || null,
    familyStatus,
    marriageDate: parseDate(data.marriageDate ?? ""),
    marriagePlace: data.marriagePlace || null,
    marriageContract: data.marriageContract || null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
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
    // Les champs ClientProfile (état civil…) ne concernent que les clients.
    if (me.role === "CLIENT") {
      await tx.clientProfile.upsert({
        where: { userId: me.id },
        create: { userId: me.id, ...profileData },
        update: profileData,
      });
    }
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: me.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata:
      "Coordonnées du profil mises à jour (prénom, nom, téléphone, adresse)",
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
    metadata: "Mot de passe modifié par l'utilisateur",
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
    metadata: "Demande de suppression de compte (RGPD)",
  });
  revalidatePath("/profil");
  return { ok: true, value: undefined };
}
