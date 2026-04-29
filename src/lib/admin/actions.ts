"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { getMailer } from "@/lib/mail";
import { invitationMail } from "@/lib/mail/admin-templates";
import { getRequestContext } from "@/lib/request-context";
import {
  inviteUserSchema,
  createProgrammeSchema,
  updateProgrammeSchema,
  assignPromoterSchema,
  lotSchema,
  updateLotSchema,
  settingsSchema,
  type InviteUserInput,
  type CreateProgrammeInput,
  type UpdateProgrammeInput,
  type LotInput,
  type UpdateLotInput,
  type SettingsInput,
} from "@/lib/admin/schemas";
import type { ActionResult } from "@/lib/auth/actions";
import { randomBytes } from "node:crypto";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// =====================================================
// USERS — INVITATION (CDC §9.1)
// =====================================================

export async function inviteUserAction(
  input: InviteUserInput,
): Promise<ActionResult<{ userId: string }>> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { email, firstName, lastName, role } = parsed.data;
  const ctx = await getRequestContext();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "Un compte existe déjà avec cette adresse email.",
    };
  }

  // Hash bcrypt d'un secret aléatoire — l'utilisateur ne pourra pas se connecter
  // tant qu'il n'a pas défini son propre mot de passe via le lien d'invitation.
  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      role,
      passwordHash: placeholderHash,
      emailVerifiedAt: new Date(), // l'admin atteste de l'identité
      status: "ACTIVE",
    },
  });

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      // 7 jours pour l'invitation initiale.
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });

  await getMailer().send(
    invitationMail(user.email, user.firstName, role, token),
  );

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { invitedRole: role, via: "admin_invitation" },
  });

  revalidatePath("/admin/utilisateurs");
  return { ok: true, value: { userId: user.id } };
}

// =====================================================
// USERS — TOGGLE ACTIVE / DEACTIVATE
// =====================================================

export async function setUserStatusAction(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  if (!userId) return { ok: false, error: "Identifiant manquant" };
  if (userId === me.id) {
    return { ok: false, error: "Impossible de modifier votre propre compte." };
  }
  const ctx = await getRequestContext();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: active ? "ACTIVE" : "SUSPENDED" },
  });
  if (!active) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    userId: me.id,
    action: active ? "USER_UPDATED" : "USER_LOCKED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { transition: active ? "→ACTIVE" : "→SUSPENDED" },
  });

  revalidatePath("/admin/utilisateurs");
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// USERS — FORCED PASSWORD RESET
// =====================================================

export async function forceResetUserPasswordAction(
  userId: string,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  if (!userId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Utilisateur introuvable" };

  // Révocation des sessions actives.
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    },
  });
  await getMailer().send(
    invitationMail(user.email, user.firstName, user.role, token),
  );

  await audit({
    userId: me.id,
    action: "USER_PASSWORD_CHANGED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { step: "admin_forced_reset" },
  });
  return { ok: true, value: undefined };
}

// =====================================================
// USERS — REVOKE SESSIONS
// =====================================================

export async function revokeUserSessionsAction(
  userId: string,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  if (!userId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: userId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { action: "sessions_revoked" },
  });

  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// PROGRAMMES — CRUD (CDC §9.2)
// =====================================================

export async function createProgrammeAction(
  input: CreateProgrammeInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = createProgrammeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  try {
    const programme = await prisma.programme.create({
      data: {
        reference: parsed.data.reference.toUpperCase(),
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        city: parsed.data.city ?? null,
        caObjective:
          parsed.data.caObjective != null
            ? new Prisma.Decimal(parsed.data.caObjective)
            : null,
      },
    });
    await audit({
      userId: me.id,
      action: "PROGRAMME_CREATED",
      resourceType: "Programme",
      resourceId: programme.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { reference: programme.reference },
    });
    revalidatePath("/admin/programmes");
    return { ok: true, value: { id: programme.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Cette référence est déjà utilisée par un autre programme.",
      };
    }
    throw e;
  }
}

export async function updateProgrammeAction(
  input: UpdateProgrammeInput,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = updateProgrammeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  await prisma.programme.update({
    where: { id: parsed.data.id },
    data: {
      reference: parsed.data.reference.toUpperCase(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      city: parsed.data.city ?? null,
      caObjective:
        parsed.data.caObjective != null
          ? new Prisma.Decimal(parsed.data.caObjective)
          : null,
    },
  });
  await audit({
    userId: me.id,
    action: "PROGRAMME_UPDATED",
    resourceType: "Programme",
    resourceId: parsed.data.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  revalidatePath("/admin/programmes");
  revalidatePath(`/admin/programmes/${parsed.data.id}`);
  return { ok: true, value: undefined };
}

export async function archiveProgrammeAction(
  programmeId: string,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  if (!programmeId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  await prisma.programme.update({
    where: { id: programmeId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await audit({
    userId: me.id,
    action: "PROGRAMME_UPDATED",
    resourceType: "Programme",
    resourceId: programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { transition: "→ARCHIVED" },
  });
  revalidatePath("/admin/programmes");
  return { ok: true, value: undefined };
}

export async function assignPromoterAction(
  input: z.infer<typeof assignPromoterSchema>,
): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  const parsed = assignPromoterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  await prisma.programmePromoter.upsert({
    where: {
      programmeId_promoterId: {
        programmeId: parsed.data.programmeId,
        promoterId: parsed.data.promoterId,
      },
    },
    create: parsed.data,
    update: {},
  });
  revalidatePath(`/admin/programmes/${parsed.data.programmeId}`);
  return { ok: true, value: undefined };
}

export async function unassignPromoterAction(
  input: z.infer<typeof assignPromoterSchema>,
): Promise<ActionResult> {
  await requireRole("SUPER_ADMIN");
  const parsed = assignPromoterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  await prisma.programmePromoter.delete({
    where: {
      programmeId_promoterId: {
        programmeId: parsed.data.programmeId,
        promoterId: parsed.data.promoterId,
      },
    },
  });
  revalidatePath(`/admin/programmes/${parsed.data.programmeId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// LOTS — CRUD
// =====================================================

function computeTtc(priceHT: number, vatRate: number): Prisma.Decimal {
  return new Prisma.Decimal(priceHT)
    .times(1 + vatRate / 100)
    .toDecimalPlaces(2);
}

export async function createLotAction(
  input: LotInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = lotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  try {
    const lot = await prisma.lot.create({
      data: {
        programmeId: data.programmeId,
        reference: data.reference.toUpperCase(),
        surface: new Prisma.Decimal(data.surface),
        floor: data.floor ?? null,
        type: data.type,
        priceHT: new Prisma.Decimal(data.priceHT),
        vatRate: new Prisma.Decimal(data.vatRate),
        priceTTC: computeTtc(data.priceHT, data.vatRate),
        status: data.status,
      },
    });
    await prisma.programme.update({
      where: { id: data.programmeId },
      data: { totalLots: { increment: 1 } },
    });
    await audit({
      userId: me.id,
      action: "LOT_STATUS_CHANGED",
      resourceType: "Lot",
      resourceId: lot.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { status: data.status, programmeId: data.programmeId },
    });
    revalidatePath(`/admin/programmes/${data.programmeId}`);
    return { ok: true, value: { id: lot.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Cette référence de lot existe déjà dans ce programme.",
      };
    }
    throw e;
  }
}

export async function updateLotAction(
  input: UpdateLotInput,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = updateLotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  await prisma.lot.update({
    where: { id: data.id },
    data: {
      reference: data.reference.toUpperCase(),
      surface: new Prisma.Decimal(data.surface),
      floor: data.floor ?? null,
      type: data.type,
      priceHT: new Prisma.Decimal(data.priceHT),
      vatRate: new Prisma.Decimal(data.vatRate),
      priceTTC: computeTtc(data.priceHT, data.vatRate),
      status: data.status,
    },
  });
  await audit({
    userId: me.id,
    action: "LOT_STATUS_CHANGED",
    resourceType: "Lot",
    resourceId: data.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  revalidatePath(`/admin/programmes/${data.programmeId}`);
  return { ok: true, value: undefined };
}

export async function deleteLotAction(lotId: string): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  if (!lotId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) return { ok: false, error: "Lot introuvable" };

  // Vérification : pas de dossier rattaché.
  const dossierCount = await prisma.dossier.count({ where: { lotId } });
  if (dossierCount > 0) {
    return {
      ok: false,
      error: "Impossible de supprimer un lot rattaché à un dossier.",
    };
  }

  await prisma.lot.delete({ where: { id: lotId } });
  await prisma.programme.update({
    where: { id: lot.programmeId },
    data: { totalLots: { decrement: 1 } },
  });
  await audit({
    userId: me.id,
    action: "LOT_STATUS_CHANGED",
    resourceType: "Lot",
    resourceId: lotId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { action: "deleted" },
  });
  revalidatePath(`/admin/programmes/${lot.programmeId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// SETTINGS (CDC §9.3)
// =====================================================

export async function updateSettingsAction(
  input: SettingsInput,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();
  const entries = Object.entries(parsed.data);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value), updatedBy: me.id },
        update: { value: String(value), updatedBy: me.id },
      }),
    ),
  );

  await audit({
    userId: me.id,
    action: "SETTINGS_UPDATED",
    resourceType: "Setting",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { keys: entries.map(([k]) => k) },
  });
  revalidatePath("/admin/parametres");
  return { ok: true, value: undefined };
}
