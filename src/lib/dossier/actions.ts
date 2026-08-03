"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import { dossierAssociatedMail } from "@/lib/mail/auto-templates";
import { createClientDossierCore } from "@/lib/dossier/client-dossier-core";
import { getRequestContext } from "@/lib/request-context";
import { hashPassword } from "@/lib/auth/password";
import { encrypt } from "@/lib/crypto";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { invitationMail } from "@/lib/mail/admin-templates";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";
import {
  buildPlaceholderEmail,
  canBeContactedByEmail,
} from "@/lib/user/no-account";
import { randomBytes, randomUUID } from "node:crypto";
import {
  assignClientSchema,
  assignCollaboratorSchema,
  createClientAndDossierSchema,
  createDossierSchema,
  relaunchClientSchema,
  setDossierOptionSchema,
  unassignClientSchema,
  updateContractStatusSchema,
  updateDossierStatusSchema,
  type AssignClientInput,
  type UnassignClientInput,
  type CreateClientAndDossierInput,
  type RelaunchClientInput,
  type SetDossierOptionInput,
  type UpdateContractStatusInput,
  type AssignCollaboratorInput,
  type CreateDossierInput,
  type UpdateDossierStatusInput,
} from "@/lib/dossier/schemas";
import { notifyDossierParticipants } from "@/lib/notifications";
import {
  planClientAssignment,
  type DossierContentCounts,
} from "@/lib/dossier/archive-rules";
import { CONTRACT_STATUS_LABEL } from "@/lib/dossier/labels";
import type { ContractStatus, TimelineKind } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/actions";

// Statuts contractuels donnant lieu à un événement de timeline dédié (jalon).
const CONTRACT_STATUS_TIMELINE_KIND: Partial<
  Record<ContractStatus, TimelineKind>
> = {
  RESERVATION_SIGNED: "RESERVATION_SIGNED",
  NOTARY_ACT_PENDING: "NOTARY_ACT_PENDING",
};

/**
 * Un dossier archivé est un historique en lecture seule (T10) : aucune
 * mutation métier ne doit plus l'affecter.
 */
const ARCHIVED_DOSSIER_ERROR =
  "Ce dossier est archivé (historique d'un client dissocié) : il est en lecture seule.";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const STATUS_TIMELINE_KIND = {
  NEW_LEAD: "LEAD_CREATED",
  RESERVATION_SENT: "RESERVATION_SENT",
  SIGNATURE_PENDING: "STATUS_CHANGE",
  SIGNED_AT_NOTARY: "TRANSMITTED_TO_NOTARY",
  LOAN_OFFER_RECEIVED: "LOAN_OFFER_RECEIVED",
  ACT_SIGNED: "ACT_SIGNED",
  BLOCKED: "STATUS_CHANGE",
} as const;

// =====================================================
// CREATE DOSSIER (CDC §4.4)
// =====================================================

export async function createDossierAction(
  input: CreateDossierInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = createDossierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  // Vérifs métier
  const programme = await prisma.programme.findUnique({
    where: { id: data.programmeId },
  });
  if (!programme || programme.status !== "ACTIVE") {
    return { ok: false, error: "Programme inactif ou introuvable." };
  }
  if (data.lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: data.lotId } });
    if (!lot || lot.programmeId !== programme.id) {
      return { ok: false, error: "Lot incompatible avec ce programme." };
    }
    if (lot.status !== "AVAILABLE") {
      return { ok: false, error: "Ce lot n'est plus disponible." };
    }
  }
  if (data.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: data.clientId },
    });
    if (!client || client.role !== "CLIENT" || client.deletedAt) {
      return { ok: false, error: "Client invalide." };
    }
    // Un client ne peut avoir qu'un seul dossier ACTIF (les dossiers archivés
    // constituent son historique et n'empêchent pas une nouvelle association).
    const existing = await prisma.dossier.findFirst({
      where: { clientId: data.clientId, archivedAt: null },
    });
    if (existing) {
      return { ok: false, error: "Ce client est déjà associé à un dossier." };
    }
  }
  const collaborator = await prisma.user.findUnique({
    where: { id: data.collaboratorId },
  });
  if (
    !collaborator ||
    collaborator.role !== "COLLABORATOR" ||
    collaborator.status !== "ACTIVE"
  ) {
    return { ok: false, error: "Collaborateur invalide." };
  }

  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.dossier.create({
      data: {
        programmeId: data.programmeId,
        clientId: data.clientId ?? null,
        status: "NEW_LEAD",
      },
    });
    await tx.dossierParticipant.create({
      data: {
        dossierId: created.id,
        userId: data.collaboratorId,
        role: "COLLABORATOR_PRIMARY",
      },
    });
    if (data.lotId) {
      await tx.lot.update({
        where: { id: data.lotId },
        data: { dossierId: created.id, status: "RESERVED" },
      });
    }
    if (data.clientId) {
      await tx.user.update({
        where: { id: data.clientId },
        data: { status: "ACTIVE" },
      });
    }
    await tx.timelineEvent.create({
      data: {
        dossierId: created.id,
        kind: "LEAD_CREATED",
        title: "Dossier créé",
        description: data.initialNote ?? null,
        actorId: me.id,
      },
    });
    return created;
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dossier créé (programme ${data.programmeId}${data.clientId ? ", avec client associé" : ""})`,
  });

  revalidatePath("/collaborateur");
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: { id: dossier.id } };
}

// =====================================================
// CRÉER LE DOSSIER D'UN LOT (T5 — un lot doit toujours être ouvrable)
// =====================================================

/**
 * Crée le dossier d'un lot qui n'en a pas encore, sans client associé.
 *
 * Permet à l'admin comme au collaborateur d'ouvrir la fiche d'un lot en
 * permanence : un lot importé sans acquéreur n'est jamais un cul-de-sac.
 */
export async function createDossierForLotAction(
  lotId: string,
): Promise<ActionResult<{ dossierId: string }>> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  if (!lotId) return { ok: false, error: "Identifiant de lot manquant." };
  const ctx = await getRequestContext();

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { id: true, programmeId: true, reference: true, dossierId: true },
  });
  if (!lot) return { ok: false, error: "Lot introuvable." };
  if (lot.dossierId) {
    return { ok: true, value: { dossierId: lot.dossierId } };
  }

  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.dossier.create({
      data: {
        programmeId: lot.programmeId,
        clientId: null,
        status: "NEW_LEAD",
      },
    });
    // Le collaborateur référent est l'utilisateur courant lorsqu'il en est un ;
    // un SUPER_ADMIN n'est pas un participant COLLABORATOR_PRIMARY valide.
    if (me.role === "COLLABORATOR") {
      await tx.dossierParticipant.create({
        data: {
          dossierId: created.id,
          userId: me.id,
          role: "COLLABORATOR_PRIMARY",
        },
      });
    }
    await tx.lot.update({
      where: { id: lot.id },
      data: { dossierId: created.id },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: created.id,
        kind: "LEAD_CREATED",
        title: "Dossier créé",
        description: `Dossier ouvert sur le lot ${lot.reference}, sans client associé.`,
        actorId: me.id,
      },
    });
    return created;
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dossier créé depuis le lot ${lot.reference}, sans client associé`,
  });

  revalidatePath("/admin/programmes");
  revalidatePath(`/admin/programmes/${lot.programmeId}`);
  revalidatePath("/collaborateur/programmes");
  revalidatePath(`/collaborateur/programmes/${lot.programmeId}`);
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: { dossierId: dossier.id } };
}

// =====================================================
// UPDATE STATUS
// =====================================================

export async function updateDossierStatusAction(
  input: UpdateDossierStatusInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = updateDossierStatusSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (dossier.status === data.status) {
    return { ok: false, error: "Le dossier a déjà ce statut." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        status: data.status,
        lastActivityAt: new Date(),
        ...(data.status === "ACT_SIGNED" ? { closedAt: new Date() } : {}),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: STATUS_TIMELINE_KIND[data.status],
        title: `Statut → ${data.status}`,
        description: data.comment ?? null,
        actorId: me.id,
      },
    });
    if (data.status === "ACT_SIGNED") {
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
    metadata: `Statut du dossier modifié : ${dossier.status} → ${data.status}`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: undefined };
}

// =====================================================
// ASSIGN CLIENT (associer un client inscrit à un dossier existant)
// =====================================================

export async function assignClientAction(
  input: AssignClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = assignClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Dossier introuvable" };
  if (dossier.archivedAt) {
    return {
      ok: false,
      error: "Ce dossier est archivé : il ne peut plus recevoir de client.",
    };
  }
  if (dossier.clientId) {
    return { ok: false, error: "Ce dossier a déjà un client associé." };
  }

  const client = await prisma.user.findUnique({
    where: { id: data.clientId },
  });
  if (!client || client.role !== "CLIENT" || client.deletedAt) {
    return { ok: false, error: "Client invalide." };
  }
  const alreadyAssociated = await prisma.dossier.findFirst({
    where: { clientId: data.clientId, archivedAt: null },
  });
  if (alreadyAssociated) {
    return { ok: false, error: "Ce client est déjà sur un autre dossier." };
  }

  // Lot porté par le dossier support : c'est lui qui identifie l'historique.
  const lots = await prisma.lot.findMany({
    where: { dossierId: dossier.id },
    select: { id: true },
  });
  const lotIds = lots.map((l) => l.id);

  // Historique : ce client avait-il déjà un dossier archivé sur ce lot ?
  const archived =
    lotIds.length > 0
      ? await prisma.dossier.findFirst({
          where: {
            clientId: data.clientId,
            archivedAt: { not: null },
            archivedLotId: { in: lotIds },
          },
          orderBy: { archivedAt: "desc" },
          select: { id: true },
        })
      : null;

  const counts = await countDossierContent(dossier.id);
  const plan = planClientAssignment({
    archivedDossierId: archived?.id ?? null,
    currentCounts: counts,
  });

  // Un client sans compte (T7) ne devient jamais ACTIVE : il n'a pas d'accès.
  const clientStatus = client.status === "NO_ACCOUNT" ? "NO_ACCOUNT" : "ACTIVE";

  /** Dossier finalement actif à l'issue de l'association. */
  let activeDossierId = dossier.id;

  try {
    await prisma.$transaction(async (tx) => {
      if (plan.kind === "reactivate") {
        activeDossierId = plan.archivedDossierId;
        // Le dossier support laisse la place au dossier historique du client.
        if (plan.currentDossierDisposal === "delete") {
          await tx.lot.updateMany({
            where: { dossierId: dossier.id },
            data: { dossierId: null },
          });
          await tx.dossier.delete({ where: { id: dossier.id } });
        } else {
          await tx.dossier.update({
            where: { id: dossier.id },
            data: {
              archivedAt: new Date(),
              archivedLotId: lotIds[0] ?? null,
            },
          });
          await tx.lot.updateMany({
            where: { dossierId: dossier.id },
            data: { dossierId: null },
          });
        }
        // Réactivation : messages, documents et timeline reviennent avec lui.
        await tx.dossier.update({
          where: { id: plan.archivedDossierId },
          data: {
            archivedAt: null,
            archivedLotId: null,
            lastActivityAt: new Date(),
          },
        });
        await tx.lot.updateMany({
          where: { id: { in: lotIds } },
          data: { dossierId: plan.archivedDossierId },
        });
        await tx.timelineEvent.create({
          data: {
            dossierId: plan.archivedDossierId,
            kind: "STATUS_CHANGE",
            title: "Dossier réactivé",
            description: `${client.firstName} ${client.lastName} — historique restitué`,
            actorId: me.id,
          },
        });
      } else {
        await tx.dossier.update({
          where: { id: dossier.id },
          data: { clientId: data.clientId, lastActivityAt: new Date() },
        });
        await tx.timelineEvent.create({
          data: {
            dossierId: dossier.id,
            kind: "STATUS_CHANGE",
            title: "Client associé",
            description: `${client.firstName} ${client.lastName}`,
            actorId: me.id,
          },
        });
      }
      await tx.user.update({
        where: { id: data.clientId },
        data: { status: clientStatus },
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ce client est déjà associé." };
    }
    throw e;
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: activeDossierId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata:
      plan.kind === "reactivate"
        ? `Client ${data.clientId} réassocié — dossier archivé réactivé avec son historique`
        : `Client ${data.clientId} associé au dossier`,
  });

  // Un client sans compte n'est ni notifié ni relancé par email (T7).
  if (client.status !== "NO_ACCOUNT") {
    // Notifier le client de l'association (déclencheur CDC §8.5)
    await notify({
      userId: data.clientId,
      kind: "DOSSIER_ASSOCIATED",
      title: "Votre dossier est prêt",
      body: `Votre dossier a été créé. Vous pouvez maintenant suivre son avancement.`,
      link: "/client",
    });
    // Email auto (CDC §8.5)
    void getMailer()
      .send(dossierAssociatedMail(client.email, client.firstName))
      .catch((err) => {
        console.error("[mail] dossierAssociated", err);
      });
  }

  revalidateDossierPaths(dossier.id, dossier.programmeId);
  revalidateDossierPaths(activeDossierId, dossier.programmeId);
  return { ok: true, value: undefined };
}

/** Compte le contenu métier d'un dossier — base de la règle « dossier vide ». */
async function countDossierContent(
  dossierId: string,
): Promise<DossierContentCounts> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      _count: {
        select: {
          messages: true,
          documents: true,
          timelineEvents: true,
          invoices: true,
          signatures: true,
          appointments: true,
          notes: true,
        },
      },
    },
  });
  return {
    messages: dossier?._count.messages ?? 0,
    documents: dossier?._count.documents ?? 0,
    timelineEvents: dossier?._count.timelineEvents ?? 0,
    invoices: dossier?._count.invoices ?? 0,
    signatures: dossier?._count.signatures ?? 0,
    appointments: dossier?._count.appointments ?? 0,
    notes: dossier?._count.notes ?? 0,
  };
}

/** Revalide les deux espaces qui exposent les dossiers (collaborateur, admin). */
function revalidateDossierPaths(dossierId: string, programmeId?: string): void {
  revalidatePath("/collaborateur/dossiers");
  revalidatePath("/admin/dossiers");
  revalidatePath(`/collaborateur/dossiers/${dossierId}`);
  revalidatePath(`/admin/dossiers/${dossierId}`);
  if (programmeId) {
    revalidatePath(`/admin/programmes/${programmeId}`);
    revalidatePath(`/collaborateur/programmes/${programmeId}`);
  }
}

// =====================================================
// UNASSIGN CLIENT (dissocier le client d'un dossier — inverse de l'association)
// =====================================================

export async function unassignClientAction(
  input: UnassignClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = unassignClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(
    parsed.data.dossierId,
    me.id,
    me.role,
  );
  if (!dossier) return { ok: false, error: "Dossier introuvable" };
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (!dossier.clientId) {
    return { ok: false, error: "Ce dossier n'a pas de client associé." };
  }

  const clientId = dossier.clientId;
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true, status: true },
  });
  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : "Client inconnu";

  const lots = await prisma.lot.findMany({
    where: { dossierId: dossier.id },
    select: { id: true },
  });

  // Le dossier n'est PAS vidé de son client : il est archivé tel quel, avec ses
  // messages, documents, timeline, notes et factures. Le client suivant repart
  // d'un dossier neuf, et une réassociation de ce client-ci le restituera (T10).
  await prisma.$transaction(async (tx) => {
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "STATUS_CHANGE",
        title: "Client dissocié — dossier archivé",
        description: clientName,
        actorId: me.id,
      },
    });
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        archivedAt: new Date(),
        archivedLotId: lots[0]?.id ?? null,
        lastActivityAt: new Date(),
      },
    });
    // Le lot redevient libre : il pourra recevoir un nouveau dossier.
    await tx.lot.updateMany({
      where: { dossierId: dossier.id },
      data: { dossierId: null },
    });
    // Le compte redevient associable, sauf s'il s'agit d'un client sans
    // compte (T7) dont le statut NO_ACCOUNT doit être préservé.
    if (client && client.status !== "NO_ACCOUNT") {
      await tx.user.update({
        where: { id: clientId },
        data: { status: "PENDING_ASSOCIATION" },
      });
    }
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Client ${clientId} (${clientName}) dissocié — dossier archivé, historique conservé`,
  });

  revalidateDossierPaths(dossier.id, dossier.programmeId);
  revalidatePath("/collaborateur/fonds");
  revalidatePath("/admin/fonds");
  for (const lot of lots) {
    revalidatePath(`/collaborateur/fonds/${lot.id}`);
    revalidatePath(`/admin/fonds/${lot.id}`);
  }
  return { ok: true, value: undefined };
}

// =====================================================
// ASSIGN COLLABORATOR
// =====================================================

export async function assignCollaboratorAction(
  input: AssignCollaboratorInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = assignCollaboratorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Dossier introuvable" };

  await prisma.dossierParticipant.upsert({
    where: {
      dossierId_userId_role: {
        dossierId: data.dossierId,
        userId: data.collaboratorId,
        role: data.role,
      },
    },
    create: {
      dossierId: data.dossierId,
      userId: data.collaboratorId,
      role: data.role,
    },
    update: {},
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: data.dossierId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Collaborateur associé au dossier avec le rôle ${data.role}`,
  });
  revalidatePath(`/collaborateur/dossiers/${data.dossierId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// CREATE CLIENT + DOSSIER (collaborateur crée un espace client)
// =====================================================

export async function createClientAndDossierAction(
  input: CreateClientAndDossierInput,
): Promise<ActionResult<{ dossierId: string; userId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = createClientAndDossierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  // Un client sans compte peut ne pas avoir d'email : on lui attribue alors une
  // adresse technique, jamais affichée ni utilisée pour un envoi (T7).
  const providedEmail = data.email?.trim() ? data.email.trim() : null;
  if (!providedEmail && !data.noAccount) {
    return {
      ok: false,
      error: "Un email est requis pour un client disposant d'un accès.",
    };
  }
  const email = providedEmail ?? buildPlaceholderEmail();

  if (providedEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: providedEmail },
    });
    if (existing) {
      return {
        ok: false,
        error:
          "Un compte existe déjà avec cet email. Utilisez plutôt « Associer un client existant ».",
      };
    }
  }

  const programme = await prisma.programme.findUnique({
    where: { id: data.programmeId },
  });
  if (!programme || programme.status !== "ACTIVE") {
    return { ok: false, error: "Programme invalide." };
  }
  if (data.lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: data.lotId } });
    if (!lot || lot.programmeId !== programme.id) {
      return { ok: false, error: "Lot incompatible." };
    }
    if (lot.status !== "AVAILABLE") {
      return { ok: false, error: "Ce lot n'est plus disponible." };
    }
  }

  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  const FAMILY_STATUSES = [
    "SINGLE",
    "MARRIED",
    "PACS",
    "DIVORCED",
    "WIDOWED",
    "COHABITING",
  ];
  const parseProfileDate = (v?: string): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const familyStatus =
    data.familyStatus && FAMILY_STATUSES.includes(data.familyStatus)
      ? (data.familyStatus as
          | "SINGLE"
          | "MARRIED"
          | "PACS"
          | "DIVORCED"
          | "WIDOWED"
          | "COHABITING")
      : null;
  // La fiche client n'est créée que si au moins un champ étendu est rempli.
  const hasProfileData = Boolean(
    data.birthName ||
    data.birthDate ||
    data.birthPlace ||
    data.profession ||
    data.nationality ||
    familyStatus ||
    data.marriageDate ||
    data.marriagePlace ||
    data.marriageContract,
  );
  // Adresse structurée — unique source : User.addressEnc (même format que /profil).
  const hasAddress = Boolean(
    data.addressLine || data.postalCode || data.city || data.country,
  );

  const { dossier, user, token } = await prisma.$transaction(async (tx) => {
    const core = await createClientDossierCore(tx, {
      email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      programmeId: data.programmeId,
      lotId: data.lotId ?? null,
      passwordHash: placeholderHash,
      noAccount: data.noAccount,
      collaboratorId: me.id,
      actorId: me.id,
      timelineTitle: `Dossier créé par ${me.name ?? "le collaborateur"}`,
      initialNote: data.initialNote ?? null,
    });
    if (hasAddress) {
      await tx.user.update({
        where: { id: core.user.id },
        data: {
          addressEnc: encrypt(
            JSON.stringify({
              line: data.addressLine ?? "",
              postalCode: data.postalCode ?? "",
              city: data.city ?? "",
              country: data.country ?? "",
            }),
          ),
        },
      });
    }
    if (hasProfileData) {
      await tx.clientProfile.create({
        data: {
          userId: core.user.id,
          birthName: data.birthName || null,
          birthDate: parseProfileDate(data.birthDate),
          birthPlace: data.birthPlace || null,
          profession: data.profession || null,
          nationality: data.nationality || null,
          familyStatus,
          marriageDate: parseProfileDate(data.marriageDate),
          marriagePlace: data.marriagePlace || null,
          marriageContract: data.marriageContract || null,
        },
      });
    }
    return core;
  });

  // Un client sans compte n'est jamais invité : pas de jeton, pas d'email (T7).
  if (token) {
    try {
      await getMailer().send(
        invitationMail(user.email, user.firstName, "CLIENT", token),
      );
    } catch (err) {
      console.error("[mail] createClient invitation", err);
    }
  }

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: data.noAccount
      ? `Client associé sans compte créé par un collaborateur (dossier ${dossier.id})`
      : `Compte client créé par un collaborateur (dossier ${dossier.id})`,
  });
  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dossier créé avec un nouveau client (programme ${data.programmeId})`,
  });

  // Pièces déposées dès la création (best-effort — n'invalide pas la création).
  if (isStorageConfigured()) {
    if (data.cniFileB64) {
      await attachCreationDocument(
        dossier.id,
        me.id,
        data.cniFileB64,
        data.cniFileName || "CNI-client.pdf",
        "CNI du client",
      );
    }
    if (data.marriageContractFileB64) {
      await attachCreationDocument(
        dossier.id,
        me.id,
        data.marriageContractFileB64,
        data.marriageContractFileName || "Contrat-de-mariage.pdf",
        null,
      );
    }
  }

  // RDV notaire déjà fixé à la création.
  if (data.notaryAppointmentAt) {
    const when = new Date(data.notaryAppointmentAt);
    if (!Number.isNaN(when.getTime())) {
      try {
        await prisma.appointment.create({
          data: {
            dossierId: dossier.id,
            scheduledAt: when,
            createdById: me.id,
            status: "SCHEDULED",
          },
        });
        await prisma.dossier.update({
          where: { id: dossier.id },
          data: { contractStatus: "NOTARY_APPOINTMENT_SCHEDULED" },
        });
        await prisma.timelineEvent.create({
          data: {
            dossierId: dossier.id,
            kind: "APPOINTMENT_SCHEDULED",
            title: "Rendez-vous notaire planifié",
            description: when.toLocaleString("fr-FR"),
            actorId: me.id,
          },
        });
      } catch (err) {
        console.error("[createClient] appointment", err);
      }
    }
  }

  revalidatePath("/collaborateur");
  revalidatePath("/collaborateur/dossiers");
  revalidatePath("/collaborateur/facturation");
  return {
    ok: true,
    value: { dossierId: dossier.id, userId: user.id },
  };
}

// =====================================================
// CREATE CLIENT ONLY (sans dossier — pour l'import tracking)
// =====================================================

const createClientOnlySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

export async function createClientOnlyAction(
  input: unknown,
): Promise<ActionResult<{ userId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = createClientOnlySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    return {
      ok: false,
      error:
        "Un compte existe déjà avec cet email. Utilisez plutôt « Associer un client existant ».",
    };
  }

  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  const { user, token } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        role: "CLIENT",
        passwordHash: placeholderHash,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        phoneEnc: data.phone ? encrypt(data.phone) : null,
      },
    });
    const { token: rawToken, hash } = generateOpaqueToken();
    await tx.passwordReset.create({
      data: {
        userId: createdUser.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
    });
    return { user: createdUser, token: rawToken };
  });

  try {
    await getMailer().send(
      invitationMail(user.email, user.firstName, "CLIENT", token),
    );
  } catch (err) {
    console.error("[mail] createClientOnly invitation", err);
  }

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Compte client créé via l'import d'un fichier de suivi",
  });

  return { ok: true, value: { userId: user.id } };
}

/** Dépose un PDF sur un dossier et, si fourni, marque la pièce demandée comme fournie. */
async function attachCreationDocument(
  dossierId: string,
  uploadedById: string,
  fileB64: string,
  fileName: string,
  requestLabel: string | null,
): Promise<void> {
  try {
    const buffer = Buffer.from(fileB64, "base64");
    const storageKey = `dossiers/${dossierId}/${randomUUID()}`;
    await putObject(storageKey, buffer, "application/pdf");
    const documentRequest = requestLabel
      ? await prisma.documentRequest.findFirst({
          where: { dossierId, label: requestLabel },
        })
      : null;
    await prisma.document.create({
      data: {
        dossierId,
        uploadedById,
        fileName,
        mimeType: "application/pdf",
        sizeBytes: buffer.byteLength,
        storageKey,
        source: "COLLABORATOR_UPLOAD",
        scanStatus: "CLEAN",
        scanCheckedAt: new Date(),
        documentRequestId: documentRequest?.id ?? null,
      },
    });
    if (documentRequest) {
      await prisma.documentRequest.update({
        where: { id: documentRequest.id },
        data: { fulfilled: true },
      });
    }
  } catch (err) {
    console.error("[createClient] attachDocument", err);
  }
}

// =====================================================
// RELANCE CLIENT (bouton dans la fiche dossier collab)
// =====================================================

export async function relaunchClientAction(
  input: RelaunchClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = relaunchClientSchema.safeParse(input);
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
  if (!dossier) return { ok: false, error: "Dossier introuvable." };
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (!dossier.clientId) {
    return { ok: false, error: "Aucun client associé à ce dossier." };
  }

  // Anti-spam : refus si une relance client a été envoyée < 12h.
  const recent = await prisma.auditLog.findFirst({
    where: {
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: dossier.id,
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60_000) },
      metadata: { startsWith: "Client relancé" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const minutesAgo = Math.round(
      (Date.now() - recent.createdAt.getTime()) / 60_000,
    );
    return {
      ok: false,
      error: `Relance déjà envoyée il y a ${minutesAgo} min. Patientez 12h.`,
    };
  }

  const client = await prisma.user.findUnique({
    where: { id: dossier.clientId },
  });
  if (!client) return { ok: false, error: "Client introuvable." };
  // Un client sans compte n'est jamais relancé par email (T7).
  if (!canBeContactedByEmail(client)) {
    return {
      ok: false,
      error:
        "Ce client est un client associé sans compte : il ne reçoit ni email ni notification.",
    };
  }

  // Email
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const link = `${baseUrl}/client`;
  try {
    await getMailer().send({
      to: client.email,
      subject: `[Équatis] Action requise sur votre dossier`,
      text:
        `Bonjour ${client.firstName},\n\n` +
        (parsed.data.comment
          ? `${parsed.data.comment}\n\n`
          : "Nous attendons des informations de votre part pour faire avancer votre dossier.\n\n") +
        `Lien direct : ${link}`,
      html: `<div style="font-family:Inter,sans-serif;background:#F8F9FA;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e6eb"><p style="color:#0FB8A9;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0">Équatis</p><h1 style="color:#1B2A4A;font-size:20px;margin:8px 0 16px">Votre dossier</h1><p style="color:#1B2A4A;font-size:14px">Bonjour ${client.firstName},</p>${parsed.data.comment ? `<div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #0FB8A9;border-radius:4px"><p style="color:#475569;font-size:14px;margin:0;white-space:pre-line">${parsed.data.comment.replace(/</g, "&lt;")}</p></div>` : `<p style="color:#475569;font-size:14px">Nous attendons des informations de votre part pour faire avancer votre dossier.</p>`}<p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#1B2A4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Accéder à mon dossier</a></p></div></div>`,
    });
  } catch (err) {
    console.error("[mail] clientRelaunch", err);
    return { ok: false, error: "Échec de l'envoi de l'email." };
  }

  // Notif in-app
  await notify({
    userId: client.id,
    kind: "DOSSIER_INACTIVE",
    title: "Relance — votre dossier",
    body:
      parsed.data.comment ??
      "Votre collaborateur attend une action de votre part.",
    link: "/client",
  });

  // Timeline + activité
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: { lastActivityAt: new Date() },
  });
  await prisma.timelineEvent.create({
    data: {
      dossierId: dossier.id,
      kind: "STATUS_CHANGE",
      title: "Client relancé par email",
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
    metadata: `Client relancé sur le dossier${parsed.data.comment ? ", avec commentaire" : ""}`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  return { ok: true, value: undefined };
}

// =====================================================
// DOSSIER OPTIONNÉ — capable d'acheter mais avec délai (CDC évolution §2)
// =====================================================

export async function setDossierOptionAction(
  input: SetDossierOptionInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = setDossierOptionSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };

  const expiresAt = data.optioned
    ? new Date(Date.now() + data.optionDelayMonths * 30 * 24 * 3600_000)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        optioned: data.optioned,
        optionExpiresAt: expiresAt,
        lastActivityAt: new Date(),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "OPTION_TAKEN",
        title: data.optioned
          ? `Dossier optionné — délai ${data.optionDelayMonths} mois`
          : "Option levée",
        description: expiresAt
          ? `Échéance le ${expiresAt.toLocaleDateString("fr-FR")}`
          : null,
        actorId: me.id,
      },
    });
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: data.optioned
      ? "Option posée sur le dossier"
      : "Option retirée du dossier",
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/collaborateur/clients-en-attente");
  return { ok: true, value: undefined };
}

// =====================================================
// RELANCE D'UNE OPTION — trace la relance dans l'historique
// =====================================================

export async function recordOptionReminderAction(
  dossierId: string,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  if (!dossierId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }
  if (!dossier.optioned) {
    return { ok: false, error: "Ce dossier n'est pas optionné." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { lastActivityAt: new Date() },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "OPTION_REMINDER",
        title: "Relance de l'option effectuée",
        description: dossier.optionExpiresAt
          ? `Échéance : ${dossier.optionExpiresAt.toLocaleDateString("fr-FR")}`
          : null,
        actorId: me.id,
      },
    });
  });

  if (dossier.clientId) {
    await notify({
      userId: dossier.clientId,
      kind: "OPTION_REMINDER",
      title: "Relance — votre dossier",
      body: "Votre option arrive à échéance. Contactez votre conseiller.",
      link: "/client",
    });
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Relance de l'option envoyée au client",
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/collaborateur/clients-en-attente");
  return { ok: true, value: undefined };
}

// =====================================================
// STATUT CONTRACTUEL — axe parallèle (CDC évolution §4)
// =====================================================

export async function updateContractStatusAction(
  input: UpdateContractStatusInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = updateContractStatusSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (dossier.contractStatus === data.contractStatus) {
    return { ok: false, error: "Le dossier a déjà ce statut contractuel." };
  }

  const label = CONTRACT_STATUS_LABEL[data.contractStatus];

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { contractStatus: data.contractStatus, lastActivityAt: new Date() },
    });
    const dedicatedKind = CONTRACT_STATUS_TIMELINE_KIND[data.contractStatus];
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: dedicatedKind ?? "CONTRACT_STATUS_CHANGE",
        title: dedicatedKind ? label : `Contrat → ${label}`,
        description: data.comment ?? null,
        actorId: me.id,
      },
    });
  });

  const client = dossier.clientId
    ? await prisma.user.findUnique({
        where: { id: dossier.clientId },
        select: { firstName: true, lastName: true },
      })
    : null;
  await notifyDossierParticipants(
    dossier.id,
    me.id,
    "CONTRACT_STATUS_CHANGE",
    `Dossier${client ? ` ${client.firstName} ${client.lastName}` : ""} — ${label}`,
    data.comment ?? null,
  );

  await audit({
    userId: me.id,
    action: "DOSSIER_STATUS_CHANGED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Statut contractuel du dossier modifié : ${dossier.contractStatus} → ${data.contractStatus}`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: undefined };
}
