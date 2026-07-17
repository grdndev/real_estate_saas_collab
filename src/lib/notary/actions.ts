"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import {
  actReadyMail,
  documentsTransmittedToNotaryMail,
  notaryRelaunchMail,
  transmittedToNotaryMail,
} from "@/lib/mail/auto-templates";
import { readObject } from "@/lib/storage/s3";
import { getRequestContext } from "@/lib/request-context";
import {
  flagMissingPieceSchema,
  transmitToNotarySchema,
  MAX_NOTARY_ATTACHMENT_TOTAL_BYTES,
  type FlagMissingPieceInput,
  type TransmitToNotaryInput,
} from "@/lib/notary/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// =====================================================
// Côté Collaborateur — TRANSMISSION AU NOTAIRE
// =====================================================

export async function transmitToNotaryAction(
  input: TransmitToNotaryInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = transmitToNotarySchema.safeParse(input);
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
  if (!dossier)
    return { ok: false, error: "Dossier introuvable ou accès refusé." };

  const documentIds = parsed.data.documentIds;
  // Retransmission : notaire déjà assigné, uniquement l'envoi des documents
  // par email (pas de réassignation ni de changement de statut).
  const isRetransmission = dossier.notaryId === parsed.data.notaryId;
  if (isRetransmission && documentIds.length === 0) {
    return { ok: false, error: "Ce notaire est déjà assigné au dossier." };
  }

  const notary = await prisma.user.findUnique({
    where: { id: parsed.data.notaryId },
  });
  if (!notary || notary.role !== "NOTARY" || notary.status !== "ACTIVE") {
    return { ok: false, error: "Notaire invalide." };
  }

  // Validation des pièces jointes : appartenance au dossier, non supprimées,
  // non infectées, taille cumulée compatible email.
  const documents =
    documentIds.length > 0
      ? await prisma.document.findMany({
          where: {
            id: { in: documentIds },
            dossierId: dossier.id,
            deletedAt: null,
          },
          select: {
            id: true,
            fileName: true,
            sizeBytes: true,
            storageKey: true,
            scanStatus: true,
          },
        })
      : [];
  if (documents.length !== documentIds.length) {
    return {
      ok: false,
      error: "Certains documents sont introuvables ou hors du dossier.",
    };
  }
  if (documents.some((d) => d.scanStatus === "INFECTED")) {
    return {
      ok: false,
      error: "Un document a été refusé par l'antivirus, envoi impossible.",
    };
  }
  const totalBytes = documents.reduce((sum, d) => sum + d.sizeBytes, 0);
  if (totalBytes > MAX_NOTARY_ATTACHMENT_TOTAL_BYTES) {
    return {
      ok: false,
      error: "Pièces jointes trop volumineuses (max ~9 Mo cumulés par email).",
    };
  }

  // Lecture S3 + encodage base64 côté serveur (avant toute écriture en base :
  // un fichier illisible annule l'opération).
  let attachments: Array<{ name: string; content: string }> = [];
  if (documents.length > 0) {
    try {
      attachments = await Promise.all(
        documents.map(async (d) => ({
          name: d.fileName,
          content: (await readObject(d.storageKey)).toString("base64"),
        })),
      );
    } catch (err) {
      console.error("[notary] lecture S3 pièces jointes", err);
      return {
        ok: false,
        error: "Impossible de lire les documents depuis le stockage.",
      };
    }
  }

  const attachmentSuffix =
    documents.length > 0 ? ` (${documents.length} pièce(s) jointe(s))` : "";

  if (isRetransmission) {
    await prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossier.id },
        data: { lastActivityAt: new Date() },
      });
      await tx.timelineEvent.create({
        data: {
          dossierId: dossier.id,
          kind: "TRANSMITTED_TO_NOTARY",
          title: `Documents envoyés au notaire${attachmentSuffix}`,
          description: parsed.data.comment ?? null,
          actorId: me.id,
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossier.id },
        data: {
          notaryId: parsed.data.notaryId,
          notaryTransmittedAt: new Date(),
          status: "SIGNED_AT_NOTARY",
          lastActivityAt: new Date(),
        },
      });
      // Si le notaire était déjà participant pour un autre rôle, upsert ;
      // sinon, ajout participant de rôle NOTARY.
      await tx.dossierParticipant.upsert({
        where: {
          dossierId_userId_role: {
            dossierId: dossier.id,
            userId: parsed.data.notaryId,
            role: "NOTARY",
          },
        },
        create: {
          dossierId: dossier.id,
          userId: parsed.data.notaryId,
          role: "NOTARY",
        },
        update: {},
      });
      await tx.timelineEvent.create({
        data: {
          dossierId: dossier.id,
          kind: "TRANSMITTED_TO_NOTARY",
          title: `Transmission au notaire${attachmentSuffix}`,
          description: parsed.data.comment ?? null,
          actorId: me.id,
        },
      });
    });
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_TRANSMITTED_NOTARY",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: isRetransmission
      ? `Documents envoyés au notaire ${parsed.data.notaryId} : ${documents.map((d) => d.fileName).join(", ")}`
      : `Dossier transmis au notaire ${parsed.data.notaryId}${documents.length > 0 ? ` avec pièces jointes : ${documents.map((d) => d.fileName).join(", ")}` : ""}`,
  });

  // Notifier le notaire
  await notify({
    userId: parsed.data.notaryId,
    kind: "TRANSMITTED_TO_NOTARY",
    title: isRetransmission ? "Documents reçus" : "Nouveau dossier reçu",
    body: isRetransmission
      ? `Dossier ${dossier.reference} : ${documents.length} document(s) transmis par email.`
      : `Dossier ${dossier.reference} transmis pour traitement.`,
    link: `/notaire/${dossier.id}`,
  });

  const programme = await prisma.programme.findUnique({
    where: { id: dossier.programmeId },
    select: { name: true },
  });
  const mail = isRetransmission
    ? documentsTransmittedToNotaryMail(
        notary.email,
        notary.firstName,
        dossier.reference,
        programme?.name ?? "—",
        documents.length,
        parsed.data.comment,
      )
    : transmittedToNotaryMail(
        notary.email,
        notary.firstName,
        dossier.reference,
        programme?.name ?? "—",
        documents.length,
      );
  if (attachments.length > 0) {
    mail.attachments = attachments;
    // Avec pièces jointes : envoi awaité, l'échec est remonté à l'utilisateur.
    try {
      await getMailer().send(mail);
    } catch (err) {
      console.error("[mail] transmittedToNotary (PJ)", err);
      revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
      revalidatePath("/notaire");
      return {
        ok: false,
        error: isRetransmission
          ? "Échec de l'envoi de l'email au notaire. Les documents restent enregistrés dans le dossier."
          : "Dossier transmis, mais échec de l'envoi de l'email avec les documents. Les documents restent enregistrés dans le dossier.",
      };
    }
  } else {
    // Email auto (CDC §8.5) — fire-and-forget comme avant.
    void getMailer()
      .send(mail)
      .catch((err) => {
        console.error("[mail] transmittedToNotary", err);
      });
  }

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/notaire");
  return { ok: true, value: undefined };
}

// =====================================================
// Côté Notaire — Maj statut (limité)
// =====================================================

export async function notaryUpdateStatusAction(
  dossierId: string,
  status: "ACT_SIGNED" | "BLOCKED",
  comment?: string,
): Promise<ActionResult> {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  if (!dossierId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier)
    return { ok: false, error: "Dossier introuvable ou accès refusé." };

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        status,
        lastActivityAt: new Date(),
        ...(status === "ACT_SIGNED" ? { closedAt: new Date() } : {}),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: status === "ACT_SIGNED" ? "ACT_SIGNED" : "STATUS_CHANGE",
        title:
          status === "ACT_SIGNED"
            ? "Acte signé chez le notaire"
            : "Dossier bloqué",
        description: comment ?? null,
        actorId: me.id,
      },
    });
    if (status === "ACT_SIGNED") {
      await tx.lot.updateMany({
        where: { dossierId: dossier.id },
        data: { status: "SOLD" },
      });
    }
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_STATUS_CHANGED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Statut du dossier modifié par le notaire : ${dossier.status} → ${status}`,
  });

  // Notifier les participants (sauf le notaire qui agit).
  if (status === "ACT_SIGNED") {
    const { notifyDossierParticipants } = await import("@/lib/notifications");
    await notifyDossierParticipants(
      dossier.id,
      me.id,
      "ACT_READY",
      "Acte signé",
      `Le dossier ${dossier.reference} a été signé chez le notaire.`,
      `/collaborateur/dossiers/${dossier.id}`,
    );

    // Notifier également les promoteurs rattachés au programme.
    const promoterLinks = await prisma.programmePromoter.findMany({
      where: { programmeId: dossier.programmeId },
      select: { promoterId: true },
    });
    await Promise.all(
      promoterLinks
        .filter((p) => p.promoterId !== me.id)
        .map((p) =>
          notify({
            userId: p.promoterId,
            kind: "ACT_READY",
            title: "Acte signé",
            body: `Le dossier ${dossier.reference} a été signé chez le notaire.`,
            link: `/promoteur/${dossier.programmeId}/ventes`,
          }),
        ),
    );
  } else if (status === "BLOCKED") {
    const { notifyDossierParticipants } = await import("@/lib/notifications");
    await notifyDossierParticipants(
      dossier.id,
      me.id,
      "DOSSIER_INACTIVE",
      "Dossier bloqué",
      `Le notaire a bloqué le dossier ${dossier.reference}.${comment ? " " + comment : ""}`,
      `/collaborateur/dossiers/${dossier.id}`,
    );

    // Email auto (CDC §8.5) au client + collaborateurs.
    void (async () => {
      const dossierWithRel = await prisma.dossier.findUnique({
        where: { id: dossier.id },
        include: {
          client: { select: { email: true, firstName: true } },
          participants: {
            where: {
              role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
            },
            include: {
              user: { select: { email: true, firstName: true } },
            },
          },
        },
      });
      if (!dossierWithRel) return;
      const mailer = getMailer();
      if (dossierWithRel.client) {
        await mailer.send(
          actReadyMail(
            dossierWithRel.client.email,
            dossierWithRel.client.firstName,
            dossier.reference,
          ),
        );
      }
      for (const p of dossierWithRel.participants) {
        await mailer.send(
          actReadyMail(p.user.email, p.user.firstName, dossier.reference),
        );
      }
    })().catch((err) => {
      console.error("[mail] actReady", err);
    });
  }

  revalidatePath(`/notaire/${dossier.id}`);
  revalidatePath("/notaire");
  return { ok: true, value: undefined };
}

// =====================================================
// Côté Notaire — Signaler une pièce manquante
// =====================================================

export async function flagMissingPieceAction(
  input: FlagMissingPieceInput,
): Promise<ActionResult> {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  const parsed = flagMissingPieceSchema.safeParse(input);
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
  if (!dossier)
    return { ok: false, error: "Dossier introuvable ou accès refusé." };

  await prisma.$transaction(async (tx) => {
    await tx.documentRequest.create({
      data: {
        dossierId: dossier.id,
        label: `[Demandé par notaire] ${parsed.data.label}`,
        required: true,
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "DOCUMENT_REQUESTED",
        title: "Pièce manquante signalée par le notaire",
        description: parsed.data.label,
        actorId: me.id,
      },
    });
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { lastActivityAt: new Date() },
    });
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Pièce manquante signalée par le notaire : « ${parsed.data.label} »`,
  });

  // Notifier les collaborateurs du dossier.
  const collaborators = await prisma.dossierParticipant.findMany({
    where: {
      dossierId: dossier.id,
      role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
    },
    select: { userId: true },
  });
  await Promise.all(
    collaborators.map((c) =>
      notify({
        userId: c.userId,
        kind: "MISSING_PIECE_REPORTED",
        title: "Pièce manquante signalée par le notaire",
        body: `${dossier.reference} : ${parsed.data.label}`,
        link: `/collaborateur/dossiers/${dossier.id}`,
      }),
    ),
  );

  revalidatePath(`/notaire/${dossier.id}`);
  return { ok: true, value: undefined };
}

// =====================================================
// Côté Collaborateur — RELANCE NOTAIRE
// =====================================================

const relaunchNotarySchema = z.object({
  dossierId: z.string().min(1),
  comment: z.string().max(500).optional(),
});

export async function relaunchNotaryAction(input: {
  dossierId: string;
  comment?: string;
}): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = relaunchNotarySchema.safeParse(input);
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
  if (!dossier.notaryId) {
    return {
      ok: false,
      error:
        "Aucun notaire n'est assigné à ce dossier. Transmettez-le d'abord à un notaire.",
    };
  }
  if (!dossier.notaryTransmittedAt) {
    return {
      ok: false,
      error: "Date de transmission manquante.",
    };
  }

  // Anti-spam : refus si une relance a déjà été envoyée dans les dernières 12h.
  const recent = await prisma.auditLog.findFirst({
    where: {
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: dossier.id,
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60_000) },
      metadata: { startsWith: "Notaire" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const minutesAgo = Math.round(
      (Date.now() - recent.createdAt.getTime()) / 60_000,
    );
    return {
      ok: false,
      error: `Une relance a déjà été envoyée il y a ${minutesAgo} min. Patientez 12h entre deux relances.`,
    };
  }

  const [notary, programme] = await Promise.all([
    prisma.user.findUnique({ where: { id: dossier.notaryId } }),
    prisma.programme.findUnique({
      where: { id: dossier.programmeId },
      select: { name: true },
    }),
  ]);
  if (!notary || notary.role !== "NOTARY") {
    return { ok: false, error: "Notaire introuvable." };
  }

  const daysSinceTransmission = Math.max(
    1,
    Math.round(
      (Date.now() - dossier.notaryTransmittedAt.getTime()) / (24 * 3600 * 1000),
    ),
  );

  // Email
  try {
    await getMailer().send(
      notaryRelaunchMail(
        notary.email,
        notary.firstName,
        dossier.reference,
        programme?.name ?? "—",
        daysSinceTransmission,
        parsed.data.comment,
      ),
    );
  } catch (err) {
    console.error("[mail] notaryRelaunch", err);
    return {
      ok: false,
      error: "Échec de l'envoi de l'email. Vérifiez la configuration mail.",
    };
  }

  // Notification in-app
  await notify({
    userId: notary.id,
    kind: "DOSSIER_INACTIVE",
    title: `Relance — dossier ${dossier.reference}`,
    body:
      parsed.data.comment ?? `Transmis depuis ${daysSinceTransmission} jours.`,
    link: `/notaire/${dossier.id}`,
  });

  // Marqueur d'activité (sans changer le statut du dossier).
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: { lastActivityAt: new Date() },
  });

  // Timeline event
  await prisma.timelineEvent.create({
    data: {
      dossierId: dossier.id,
      kind: "STATUS_CHANGE",
      title: "Notaire relancé par email",
      description: parsed.data.comment ?? null,
      actorId: me.id,
    },
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Notaire ${notary.id} relancé, ${daysSinceTransmission} jour(s) après la transmission${parsed.data.comment ? ", avec commentaire" : ""}`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  return { ok: true, value: undefined };
}
