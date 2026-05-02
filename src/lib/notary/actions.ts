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
  transmittedToNotaryMail,
} from "@/lib/mail/auto-templates";
import { getRequestContext } from "@/lib/request-context";
import {
  flagMissingPieceSchema,
  transmitToNotarySchema,
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

  if (dossier.notaryId === parsed.data.notaryId) {
    return { ok: false, error: "Ce notaire est déjà assigné au dossier." };
  }

  const notary = await prisma.user.findUnique({
    where: { id: parsed.data.notaryId },
  });
  if (!notary || notary.role !== "NOTARY" || notary.status !== "ACTIVE") {
    return { ok: false, error: "Notaire invalide." };
  }

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
        title: "Transmission au notaire",
        description: parsed.data.comment ?? null,
        actorId: me.id,
      },
    });
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_TRANSMITTED_NOTARY",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { notaryId: parsed.data.notaryId },
  });

  // Notifier le notaire
  await notify({
    userId: parsed.data.notaryId,
    kind: "TRANSMITTED_TO_NOTARY",
    title: "Nouveau dossier reçu",
    body: `Dossier ${dossier.reference} transmis pour traitement.`,
    link: `/notaire/${dossier.id}`,
  });
  // Email auto (CDC §8.5)
  void (async () => {
    const programme = await prisma.programme.findUnique({
      where: { id: dossier.programmeId },
      select: { name: true },
    });
    await getMailer().send(
      transmittedToNotaryMail(
        notary.email,
        notary.firstName,
        dossier.reference,
        programme?.name ?? "—",
      ),
    );
  })().catch((err) => {
    console.error("[mail] transmittedToNotary", err);
  });

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
    if (status === "ACT_SIGNED" && dossier.lotId) {
      await tx.lot.update({
        where: { id: dossier.lotId },
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
    metadata: { from: dossier.status, to: status, by: "notary" },
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
    metadata: { step: "missing_piece_flagged", label: parsed.data.label },
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
