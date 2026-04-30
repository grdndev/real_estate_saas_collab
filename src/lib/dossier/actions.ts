"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { generateDossierReference } from "@/lib/dossier/reference";
import { getRequestContext } from "@/lib/request-context";
import {
  assignClientSchema,
  assignCollaboratorSchema,
  createDossierSchema,
  updateDossierStatusSchema,
  type AssignClientInput,
  type AssignCollaboratorInput,
  type CreateDossierInput,
  type UpdateDossierStatusInput,
} from "@/lib/dossier/schemas";
import type { ActionResult } from "@/lib/auth/actions";

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
): Promise<ActionResult<{ id: string; reference: string }>> {
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
    // Un client ne peut avoir qu'un seul dossier (schéma : Dossier.clientId @unique).
    const existing = await prisma.dossier.findUnique({
      where: { clientId: data.clientId },
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

  const reference = await generateDossierReference();

  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.dossier.create({
      data: {
        reference,
        programmeId: data.programmeId,
        lotId: data.lotId ?? null,
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
        data: { status: "RESERVED" },
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
    metadata: {
      reference,
      programmeId: data.programmeId,
      hasClient: Boolean(data.clientId),
    },
  });

  revalidatePath("/collaborateur");
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: { id: dossier.id, reference } };
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
    // Si ACT_SIGNED, le lot passe à SOLD.
    if (data.status === "ACT_SIGNED" && dossier.lotId) {
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
    metadata: { from: dossier.status, to: data.status },
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
  if (dossier.clientId) {
    return { ok: false, error: "Ce dossier a déjà un client associé." };
  }

  const client = await prisma.user.findUnique({
    where: { id: data.clientId },
  });
  if (!client || client.role !== "CLIENT" || client.deletedAt) {
    return { ok: false, error: "Client invalide." };
  }
  const alreadyAssociated = await prisma.dossier.findUnique({
    where: { clientId: data.clientId },
  });
  if (alreadyAssociated) {
    return { ok: false, error: "Ce client est déjà sur un autre dossier." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: dossier.id },
        data: { clientId: data.clientId, lastActivityAt: new Date() },
      });
      await tx.user.update({
        where: { id: data.clientId },
        data: { status: "ACTIVE" },
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
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { action: "client_assigned", clientId: data.clientId },
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
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
    metadata: { action: "collaborator_assigned", role: data.role },
  });
  revalidatePath(`/collaborateur/dossiers/${data.dossierId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// REVEAL CLIENT NAME (audit + retour du nom)
// =====================================================

export async function revealClientNameAction(
  dossierId: string,
): Promise<ActionResult<{ firstName: string; lastName: string }>> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  if (!dossierId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier || !dossier.clientId) {
    return { ok: false, error: "Dossier introuvable ou sans client." };
  }
  const client = await prisma.user.findUnique({
    where: { id: dossier.clientId },
    select: { firstName: true, lastName: true },
  });
  if (!client) return { ok: false, error: "Client introuvable" };

  await audit({
    userId: me.id,
    action: "CLIENT_NAME_REVEALED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return {
    ok: true,
    value: { firstName: client.firstName, lastName: client.lastName },
  };
}
