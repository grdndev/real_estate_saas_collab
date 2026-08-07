"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import { getMailer } from "@/lib/mail";
import { invitationMail } from "@/lib/mail/admin-templates";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { encrypt } from "@/lib/crypto";
import {
  buildPlaceholderEmail,
  isPlaceholderEmail,
} from "@/lib/user/no-account";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Gestion des « clients associés » sans compte (T7).
 *
 * Un client sans compte est un `User` de rôle CLIENT au statut `NO_ACCOUNT` :
 * fiche de contact associable à un dossier, sans accès à la plateforme. Ces
 * actions sont réservées au SUPER_ADMIN et au COLLABORATOR.
 */

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const contactSchema = z.object({
  // Seuls le nom et le prénom sont obligatoires (T11).
  firstName: z.string().min(1, "Prénom requis").max(60).trim(),
  lastName: z.string().min(1, "Nom requis").max(60).trim(),
  email: z
    .union([z.email("Email invalide").toLowerCase(), z.literal("")])
    .optional(),
  phone: z
    .string()
    .regex(/^[0-9 +().-]*$/, "Format invalide")
    .max(30)
    .optional()
    .or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});

type CreateAssociatedClientInput = z.infer<typeof contactSchema>;
const updateAssociatedClientSchema = contactSchema.extend({
  clientId: z.string().min(1),
});
type UpdateAssociatedClientInput = z.infer<typeof updateAssociatedClientSchema>;

/** Sérialise l'adresse au format attendu par `User.addressEnc`. */
function encodeAddress(data: CreateAssociatedClientInput): string | null {
  const hasAddress = Boolean(
    data.addressLine || data.postalCode || data.city || data.country,
  );
  if (!hasAddress) return null;
  return encrypt(
    JSON.stringify({
      line: data.addressLine ?? "",
      postalCode: data.postalCode ?? "",
      city: data.city ?? "",
      country: data.country ?? "",
    }),
  );
}

/**
 * Écrans impactés par toute écriture sur un client associé : les deux listes
 * cloisonnées (collaborateur / admin) et les grilles de lots qui affichent son
 * nom. Fonction locale — un module `"use server"` ne peut exporter que des
 * fonctions asynchrones.
 */
function revalidateAssociatedClientPaths(): void {
  revalidatePath("/collaborateur/clients/associes");
  revalidatePath("/admin/clients/associes");
  revalidatePath("/collaborateur/lots");
  revalidatePath("/admin/lots");
}

// =====================================================
// CRÉATION D'UN CLIENT ASSOCIÉ (sans compte)
// =====================================================

export async function createAssociatedClientAction(
  input: CreateAssociatedClientInput,
): Promise<ActionResult<{ clientId: string }>> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const providedEmail = data.email?.trim() ? data.email.trim() : null;
  if (providedEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: providedEmail },
    });
    if (existing) {
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    }
  }

  // Mot de passe inexploitable : la chaîne n'est pas un hash bcrypt valide,
  // donc `verifyPassword` échouera toujours. Le statut NO_ACCOUNT bloque de
  // toute façon la connexion en amont (src/auth.ts).
  const unusablePasswordHash = "no-account";

  const client = await prisma.user.create({
    data: {
      email: providedEmail ?? buildPlaceholderEmail(),
      firstName: data.firstName,
      lastName: data.lastName,
      role: "CLIENT",
      status: "NO_ACCOUNT",
      passwordHash: unusablePasswordHash,
      emailVerifiedAt: null,
      phoneEnc: data.phone?.trim() ? encrypt(data.phone.trim()) : null,
      addressEnc: encodeAddress(data),
    },
  });

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: client.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Client associé sans compte créé",
  });

  revalidateAssociatedClientPaths();
  return { ok: true, value: { clientId: client.id } };
}

// =====================================================
// MODIFICATION D'UN CLIENT ASSOCIÉ
// =====================================================

export async function updateAssociatedClientAction(
  input: UpdateAssociatedClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = updateAssociatedClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const client = await prisma.user.findUnique({
    where: { id: data.clientId },
    select: { id: true, role: true, status: true, email: true },
  });
  if (!client || client.role !== "CLIENT") {
    return { ok: false, error: "Client introuvable." };
  }
  if (client.status !== "NO_ACCOUNT") {
    return {
      ok: false,
      error:
        "Ce client dispose d'un compte : modifiez sa fiche depuis le dossier.",
    };
  }

  const providedEmail = data.email?.trim() ? data.email.trim() : null;
  if (providedEmail && providedEmail !== client.email) {
    const existing = await prisma.user.findUnique({
      where: { email: providedEmail },
    });
    if (existing) {
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    }
  }

  try {
    await prisma.user.update({
      where: { id: client.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        // Sans email fourni, on conserve l'adresse technique existante.
        email:
          providedEmail ??
          (isPlaceholderEmail(client.email)
            ? client.email
            : buildPlaceholderEmail()),
        phoneEnc: data.phone?.trim() ? encrypt(data.phone.trim()) : null,
        addressEnc: encodeAddress(data),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    }
    throw e;
  }

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: client.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Fiche d'un client associé sans compte mise à jour",
  });

  revalidateAssociatedClientPaths();
  return { ok: true, value: undefined };
}

// =====================================================
// SUPPRESSION D'UN CLIENT ASSOCIÉ
// =====================================================

/**
 * Supprime la fiche d'un client sans compte.
 *
 * Trois cas, dans cet ordre :
 * - dossier ACTIF → refus : il faut d'abord dissocier le client de son lot,
 *   pour que la libération du lot reste une décision explicite ;
 * - dossiers uniquement archivés → soft-delete (`deletedAt`), afin de conserver
 *   l'historique (documents, timeline, factures) exigé par la piste d'audit ;
 * - aucun dossier → suppression définitive, la fiche n'a rien produit.
 */
export async function deleteAssociatedClientAction(
  clientId: string,
): Promise<ActionResult<{ mode: "soft" | "hard" }>> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  if (!clientId) return { ok: false, error: "Identifiant manquant." };
  const ctx = await getRequestContext();

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      deletedAt: true,
    },
  });
  if (!client || client.role !== "CLIENT" || client.deletedAt) {
    return { ok: false, error: "Client introuvable." };
  }
  if (client.status !== "NO_ACCOUNT") {
    return {
      ok: false,
      error:
        "Ce client dispose d'un compte : sa suppression relève d'une demande RGPD.",
    };
  }

  const [activeDossiers, totalDossiers] = await Promise.all([
    prisma.dossier.count({ where: { clientId, archivedAt: null } }),
    prisma.dossier.count({ where: { clientId } }),
  ]);
  if (activeDossiers > 0) {
    return {
      ok: false,
      error:
        "Ce client suit encore un dossier actif. Dissociez-le de son lot depuis la fiche du lot avant de le supprimer.",
    };
  }

  const mode: "soft" | "hard" = totalDossiers > 0 ? "soft" : "hard";
  if (mode === "soft") {
    await prisma.user.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });
  } else {
    await prisma.user.delete({ where: { id: clientId } });
  }

  await audit({
    userId: me.id,
    action: "USER_DELETED",
    resourceType: "User",
    resourceId: clientId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata:
      mode === "soft"
        ? `Client associé sans compte « ${client.firstName} ${client.lastName} » supprimé (soft-delete — ${totalDossiers} dossier(s) archivé(s) conservé(s))`
        : `Client associé sans compte « ${client.firstName} ${client.lastName} » supprimé définitivement (aucun dossier)`,
  });

  revalidateAssociatedClientPaths();
  return { ok: true, value: { mode } };
}

// =====================================================
// CONVERSION EN CLIENT AVEC COMPTE
// =====================================================

const convertSchema = z.object({
  clientId: z.string().min(1),
  email: z.email("Email invalide").toLowerCase(),
});
type ConvertToAccountInput = z.infer<typeof convertSchema>;

/**
 * Transforme un client associé en client disposant d'un accès : lui attribue
 * une adresse email réelle et lui envoie une invitation.
 *
 * Le dossier et tout son contenu sont conservés : seul le statut du compte
 * change, l'identifiant du `User` reste le même.
 */
export async function convertToAccountClientAction(
  input: ConvertToAccountInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = convertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { clientId, email } = parsed.data;
  const ctx = await getRequestContext();

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      role: true,
      status: true,
      email: true,
      firstName: true,
    },
  });
  if (!client || client.role !== "CLIENT") {
    return { ok: false, error: "Client introuvable." };
  }
  if (client.status !== "NO_ACCOUNT") {
    return { ok: false, error: "Ce client dispose déjà d'un compte." };
  }

  const conflict = await prisma.user.findUnique({ where: { email } });
  if (conflict && conflict.id !== client.id) {
    return { ok: false, error: "Un compte existe déjà avec cet email." };
  }

  const { token, hash } = generateOpaqueToken();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: client.id },
        data: {
          email,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          // Le mot de passe reste inexploitable jusqu'à ce que le client en
          // définisse un via le lien d'invitation.
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordReset.create({
        data: {
          userId: client.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        },
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    }
    throw e;
  }

  try {
    await getMailer().send(
      invitationMail(email, client.firstName, "CLIENT", token),
    );
  } catch (err) {
    console.error("[mail] convertToAccount invitation", err);
  }

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: client.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata:
      "Client associé converti en client avec compte — invitation envoyée",
  });

  revalidateAssociatedClientPaths();
  return { ok: true, value: undefined };
}
