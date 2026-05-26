"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import type { FamilyStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/actions";

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

  const familyStatus =
    data.familyStatus && data.familyStatus in FAMILY_STATUS_LABEL
      ? (data.familyStatus as FamilyStatus)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: dossier.clientId! },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneEnc: data.phone ? encrypt(data.phone) : null,
      },
    });
    await tx.clientProfile.upsert({
      where: { userId: dossier.clientId! },
      create: {
        userId: dossier.clientId!,
        birthName: data.birthName || null,
        birthDate: parseDate(data.birthDate ?? ""),
        birthPlace: data.birthPlace || null,
        profession: data.profession || null,
        nationality: data.nationality || null,
        addressEnc: data.address ? encrypt(data.address) : null,
        familyStatus,
        marriageDate: parseDate(data.marriageDate ?? ""),
        marriagePlace: data.marriagePlace || null,
        marriageContract: data.marriageContract || null,
      },
      update: {
        birthName: data.birthName || null,
        birthDate: parseDate(data.birthDate ?? ""),
        birthPlace: data.birthPlace || null,
        profession: data.profession || null,
        nationality: data.nationality || null,
        addressEnc: data.address ? encrypt(data.address) : null,
        familyStatus,
        marriageDate: parseDate(data.marriageDate ?? ""),
        marriagePlace: data.marriagePlace || null,
        marriageContract: data.marriageContract || null,
      },
    });
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "ClientProfile",
    resourceId: dossier.clientId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { step: "client_profile_updated", dossierId: dossier.id },
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath(`/collaborateur/dossiers/${dossier.id}/fiche-client`);
  return { ok: true, value: undefined };
}
