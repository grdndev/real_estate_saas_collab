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
import { canBeContactedByEmail } from "@/lib/user/no-account";
import {
  invalidateCompanyLogoCache,
  invalidateSettingsCache,
} from "@/lib/settings";
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
    metadata: `Utilisateur ${user.email} invité avec le rôle ${role} via l'interface admin`,
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

  // Un « client associé » sans compte (T7) n'a ni identifiants ni adresse
  // réelle : le basculer en ACTIVE casserait l'invariant du statut.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!target) return { ok: false, error: "Utilisateur introuvable" };
  if (target.status === "NO_ACCOUNT") {
    return {
      ok: false,
      error:
        "Ce client n'a pas de compte. Utilisez « Créer un accès » depuis son dossier pour lui en ouvrir un.",
    };
  }

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
    metadata: active
      ? "Compte utilisateur réactivé"
      : "Compte utilisateur suspendu",
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
  // Sans compte ni adresse réelle (T7), l'invitation partirait dans le vide.
  if (!canBeContactedByEmail(user)) {
    return {
      ok: false,
      error:
        "Ce client n'a pas de compte ni d'adresse email : aucune invitation ne peut lui être envoyée.",
    };
  }

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
    metadata: "Réinitialisation du mot de passe forcée par un administrateur",
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
    metadata:
      "Sessions actives de l'utilisateur révoquées par un administrateur",
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
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
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
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        zipcode: parsed.data.zipcode ?? null,
        city: parsed.data.city ?? null,
        address: parsed.data.address ?? null,
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
      metadata: `Programme ${programme.name} créé`,
    });
    revalidateProgrammePaths();
    return { ok: true, value: { id: programme.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Un programme porte déjà ce nom.",
      };
    }
    throw e;
  }
}

export async function updateProgrammeAction(
  input: UpdateProgrammeInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = updateProgrammeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  try {
    await prisma.programme.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        zipcode: parsed.data.zipcode ?? null,
        city: parsed.data.city ?? null,
        address: parsed.data.address ?? null,
        caObjective:
          parsed.data.caObjective != null
            ? new Prisma.Decimal(parsed.data.caObjective)
            : null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Un programme porte déjà ce nom." };
    }
    throw e;
  }
  await audit({
    userId: me.id,
    action: "PROGRAMME_UPDATED",
    resourceType: "Programme",
    resourceId: parsed.data.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Informations du programme mises à jour",
  });
  revalidateProgrammePaths(parsed.data.id);
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
    metadata: "Programme archivé",
  });
  revalidateProgrammePaths(programmeId);
  return { ok: true, value: undefined };
}

export async function assignPromoterAction(
  input: z.infer<typeof assignPromoterSchema>,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = assignPromoterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }

  const programme = await prisma.programme.findUnique({
    where: { id: parsed.data.programmeId },
  });
  if (!programme) {
    return { ok: false, error: "Programme introuvable" };
  }
  if (programme.status === "ARCHIVED") {
    return {
      ok: false,
      error: "Impossible d'assigner un promoteur à un programme archivé.",
    };
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
  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "PROMOTER_ASSIGNED",
    resourceType: "Programme",
    resourceId: parsed.data.programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Promoteur assigné au programme ${programme.name}`,
  });
  revalidatePath(`/admin/programmes/${parsed.data.programmeId}`);
  return { ok: true, value: undefined };
}

export async function unassignPromoterAction(
  input: z.infer<typeof assignPromoterSchema>,
): Promise<ActionResult> {
  const me = await requireRole("SUPER_ADMIN");
  const parsed = assignPromoterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }

  const programme = await prisma.programme.findUnique({
    where: { id: parsed.data.programmeId },
  });
  if (!programme) {
    return { ok: false, error: "Programme introuvable" };
  }
  if (programme.status === "ARCHIVED") {
    return {
      ok: false,
      error: "Impossible de retirer un promoteur d'un programme archivé.",
    };
  }

  await prisma.programmePromoter.delete({
    where: {
      programmeId_promoterId: {
        programmeId: parsed.data.programmeId,
        promoterId: parsed.data.promoterId,
      },
    },
  });
  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "PROMOTER_UNASSIGNED",
    resourceType: "Programme",
    resourceId: parsed.data.programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Promoteur retiré du programme ${programme.name}`,
  });
  revalidatePath(`/admin/programmes/${parsed.data.programmeId}`);
  return { ok: true, value: undefined };
}

// =====================================================
// LOTS — CRUD
// =====================================================

/** Montant € facultatif → Decimal Prisma, en conservant le `null`. */
function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  return value != null ? new Prisma.Decimal(value) : null;
}

/**
 * Champs du lot pilotés par la saisie, communs à la création et à l'édition.
 * Ni `programmeId` (immuable) ni `status` (piloté par le dossier) n'en font
 * partie.
 *
 * Les trois montants HT / TVA / FAI sont écrits tels quels : aucun n'est
 * recalculé à partir des deux autres.
 */
function lotWritableFields(data: Omit<LotInput, "status" | "programmeId">) {
  return {
    reference: data.reference.toUpperCase(),
    building: data.building ?? null,
    floor: data.floor ?? null,
    type: data.type,
    notes: data.notes ?? null,
    surface: new Prisma.Decimal(data.surface),
    annexSurface: toDecimal(data.annexSurface),
    suv: toDecimal(data.suv),
    garden: toDecimal(data.garden),
    priceHT: new Prisma.Decimal(data.priceHT),
    vatRate: new Prisma.Decimal(data.vatRate),
    priceTTC: new Prisma.Decimal(data.priceTTC),
    priceNetVendeur: toDecimal(data.priceNetVendeur),
    priceNetVendeurWithParking: toDecimal(data.priceNetVendeurWithParking),
    commissionAgence: toDecimal(data.commissionAgence),
    commissionAgenceParking: toDecimal(data.commissionAgenceParking),
    priceLocation: toDecimal(data.priceLocation),
    creditImpot35: toDecimal(data.creditImpot35),
    priceRevientCrdImp: toDecimal(data.priceRevientCrdImp),
    additionalParking: data.additionalParking ?? null,
  };
}

/**
 * Rôles autorisés à gérer les programmes et leurs lots.
 * Le collaborateur dispose des mêmes droits que l'admin sur ce périmètre (T12) ;
 * les sections utilisateurs, paramètres et logs restent réservées au SUPER_ADMIN.
 */
const PROGRAMME_MANAGER_ROLES = [
  "SUPER_ADMIN",
  "COLLABORATOR",
  "PROMOTER",
] as const;

/** Chemins à revalider après une écriture sur un programme ou ses lots. */
function revalidateProgrammePaths(programmeId?: string): void {
  revalidatePath("/admin/programmes");
  revalidatePath("/collaborateur/programmes");
  if (programmeId) {
    revalidatePath(`/admin/programmes/${programmeId}`);
    revalidatePath(`/collaborateur/programmes/${programmeId}`);
    revalidatePath(`/admin/suivi/${programmeId}/lots`);
    revalidatePath(`/promoteur/${programmeId}/lots`);
  }
}

/** Chemins à revalider après une écriture sur un lot précis. */
function revalidateLotPaths(lotId: string, programmeId?: string): void {
  revalidateProgrammePaths(programmeId);
  revalidatePath("/admin/lots");
  revalidatePath("/collaborateur/lots");
  revalidatePath(`/admin/lots/${lotId}`);
  revalidatePath(`/collaborateur/lots/${lotId}`);
}

async function ensureProgrammeAccess(
  programmeId: string,
  userId: string,
  role: "SUPER_ADMIN" | "COLLABORATOR" | "PROMOTER",
): Promise<boolean> {
  // L'équipe interne accède à tous les programmes (plateforme collaborative).
  if (role === "SUPER_ADMIN" || role === "COLLABORATOR") return true;

  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
  });
  if (!programme || programme.status === "ARCHIVED") return false;

  const link = await prisma.programmePromoter.findUnique({
    where: { programmeId_promoterId: { programmeId, promoterId: userId } },
  });
  return !!link;
}

export async function createLotAction(
  input: LotInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole([...PROGRAMME_MANAGER_ROLES]);
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

  const hasAccess = await ensureProgrammeAccess(
    data.programmeId,
    me.id,
    me.role as "SUPER_ADMIN" | "COLLABORATOR" | "PROMOTER",
  );
  if (!hasAccess) {
    return { ok: false, error: "Accès refusé à ce programme." };
  }

  try {
    const lot = await prisma.lot.create({
      data: {
        programmeId: data.programmeId,
        ...lotWritableFields(data),
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
      metadata: `Lot créé avec le statut ${data.status} (programme ${data.programmeId})`,
    });
    revalidateLotPaths(lot.id, data.programmeId);
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
  const me = await requireRole([...PROGRAMME_MANAGER_ROLES]);
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

  // Le programme de rattachement vient de la base, jamais de la saisie : sinon
  // un promoteur pourrait faire passer le contrôle d'accès avec l'un de ses
  // programmes tout en modifiant le lot d'un autre.
  const existing = await prisma.lot.findUnique({
    where: { id: data.id },
    select: { programmeId: true },
  });
  if (!existing) return { ok: false, error: "Lot introuvable" };

  const hasAccess = await ensureProgrammeAccess(
    existing.programmeId,
    me.id,
    me.role as "SUPER_ADMIN" | "COLLABORATOR" | "PROMOTER",
  );
  if (!hasAccess) {
    return { ok: false, error: "Accès refusé à ce programme." };
  }

  try {
    await prisma.lot.update({
      where: { id: data.id },
      data: lotWritableFields(data),
    });
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

  await audit({
    userId: me.id,
    action: "LOT_STATUS_CHANGED",
    resourceType: "Lot",
    resourceId: data.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Lot mis à jour (programme ${existing.programmeId})`,
  });
  revalidateLotPaths(data.id, existing.programmeId);
  return { ok: true, value: undefined };
}

export async function deleteLotAction(lotId: string): Promise<ActionResult> {
  const me = await requireRole([...PROGRAMME_MANAGER_ROLES]);
  if (!lotId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) return { ok: false, error: "Lot introuvable" };

  const hasAccess = await ensureProgrammeAccess(
    lot.programmeId,
    me.id,
    me.role as "SUPER_ADMIN" | "COLLABORATOR" | "PROMOTER",
  );
  if (!hasAccess) {
    return { ok: false, error: "Accès refusé à ce programme." };
  }

  if (lot.dossierId) {
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
    metadata: `Lot supprimé (programme ${lot.programmeId})`,
  });
  revalidateProgrammePaths(lot.programmeId);
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
  // COMPANY_LOGO est traité à part : valeur vide/null = suppression de la clé.
  const { COMPANY_LOGO, ...plateforme } = parsed.data;
  const entries = Object.entries(plateforme);

  await prisma.$transaction([
    ...entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value), updatedBy: me.id },
        update: { value: String(value), updatedBy: me.id },
      }),
    ),
    COMPANY_LOGO
      ? prisma.setting.upsert({
          where: { key: "COMPANY_LOGO" },
          create: {
            key: "COMPANY_LOGO",
            value: COMPANY_LOGO,
            updatedBy: me.id,
          },
          update: { value: COMPANY_LOGO, updatedBy: me.id },
        })
      : prisma.setting.deleteMany({ where: { key: "COMPANY_LOGO" } }),
  ]);
  invalidateSettingsCache();
  invalidateCompanyLogoCache();

  await audit({
    userId: me.id,
    action: "SETTINGS_UPDATED",
    resourceType: "Setting",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Paramètres de la plateforme mis à jour : ${[
      ...entries.map(([k]) => k),
      COMPANY_LOGO ? "COMPANY_LOGO" : "COMPANY_LOGO (supprimé)",
    ].join(", ")}`,
  });
  revalidatePath("/admin/parametres");
  return { ok: true, value: undefined };
}
