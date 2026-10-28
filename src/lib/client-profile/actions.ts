"use server";

import { revalidateLotPaths } from "@/lib/lot/revalidate";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { encrypt } from "@/lib/crypto";
import { getRequestContext } from "@/lib/request-context";
import {
  upsertClientProfileSchema,
  FAMILY_STATUS_LABEL,
  type UpsertClientProfileInput,
} from "@/lib/client-profile/schemas";
import { displayableEmail, resolveClientEmail } from "@/lib/user/no-account";
import type { FamilyStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/actions";

const EMAIL_TAKEN_ERROR = "Cet email est déjà utilisé par un autre compte.";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Crée ou met à jour la fiche client complète d'un dossier (CDC évolution §4).
 */
export async function upsertClientProfileAction(
  input: UpsertClientProfileInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = upsertClientProfileSchema.safeParse(input);
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
  if (!dossier.clientId) {
    return {
      ok: false,
      error: "Associez d'abord un client à ce dossier.",
    };
  }
  const clientId = dossier.clientId;

  const client = await prisma.user.findUniqueOrThrow({
    where: { id: clientId },
    select: { email: true, status: true },
  });
  const email = resolveClientEmail(data.email, client);
  if (!email) {
    return {
      ok: false,
      error: "L'email est obligatoire pour un client disposant d'un compte.",
      fieldErrors: { email: ["Email requis"] },
    };
  }
  const emailChanged = email !== client.email;
  if (emailChanged) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== clientId) {
      return { ok: false, error: EMAIL_TAKEN_ERROR };
    }
  }

  const familyStatus =
    data.familyStatus && data.familyStatus in FAMILY_STATUS_LABEL
      ? (data.familyStatus as FamilyStatus)
      : null;

  // Adresse structurée — unique source : User.addressEnc (même format que /profil).
  // Si les 4 champs sont vides, on ne touche pas à l'adresse existante.
  const hasAddress = Boolean(
    data.addressLine || data.postalCode || data.city || data.country,
  );

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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: clientId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phoneEnc: data.phone ? encrypt(data.phone) : null,
          ...(hasAddress
            ? {
                addressEnc: encrypt(
                  JSON.stringify({
                    line: data.addressLine ?? "",
                    postalCode: data.postalCode ?? "",
                    city: data.city ?? "",
                    country: data.country ?? "",
                  }),
                ),
              }
            : {}),
        },
      });
      await tx.clientProfile.upsert({
        where: { userId: clientId },
        create: { userId: clientId, ...profileData },
        update: profileData,
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: EMAIL_TAKEN_ERROR };
    }
    throw e;
  }

  const emailChange = emailChanged
    ? `, email ${displayableEmail(client.email) ?? "aucun"} → ${displayableEmail(email) ?? "aucun"}`
    : "";
  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "ClientProfile",
    resourceId: clientId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Fiche client mise à jour (dossier ${dossier.id}${emailChange})`,
  });

  revalidateLotPaths(dossier.lotId);
  revalidateLotPaths(dossier.lotId, "/fiche-client");
  return { ok: true, value: undefined };
}
