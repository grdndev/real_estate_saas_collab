"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth/guards";
import { programmesForPromoter } from "@/lib/promoter/access";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import {
  createProspectSchema,
  importProspectsSchema,
  updateProspectStatusSchema,
  type CreateProspectInput,
  type ImportProspectsInput,
  type UpdateProspectStatusInput,
} from "@/lib/prospect/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const REVALIDATE_PATHS = [
  "/collaborateur/prospects",
  "/promoteur/prospects",
  "/collaborateur/clients-en-attente",
] as const;

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

/**
 * Cloisonnement PROMOTER : un promoteur ne peut agir que sur les prospects
 * rattachés à ses propres programmes (même frontière que la page
 * /promoteur/prospects). Les autres rôles ne sont pas restreints.
 */
async function isWithinPromoterScope(
  me: SessionUser,
  programmeId: string | null | undefined,
): Promise<boolean> {
  if (me.role !== "PROMOTER") return true;
  if (!programmeId) return false;
  const allowed = await programmesForPromoter(me.id);
  return allowed.includes(programmeId);
}

export async function createProspectAction(
  input: CreateProspectInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = createProspectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  if (!(await isWithinPromoterScope(me, data.programmeId))) {
    return { ok: false, error: "Programme hors de votre périmètre" };
  }
  const ctx = await getRequestContext();

  try {
    const prospect = await prisma.prospect.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        city: data.city || null,
        programmeId: data.programmeId || null,
        source: data.source || "manual",
        notes: data.notes || null,
        ownerId: me.role === "COLLABORATOR" ? me.id : null,
      },
    });
    await audit({
      userId: me.id,
      action: "USER_CREATED",
      resourceType: "Prospect",
      resourceId: prospect.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: "Prospect créé manuellement",
    });
    revalidateAll();
    return { ok: true, value: { id: prospect.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Un prospect avec cet email existe déjà pour ce programme.",
      };
    }
    throw e;
  }
}

export async function updateProspectStatusAction(
  input: UpdateProspectStatusInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = updateProspectStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  const ctx = await getRequestContext();

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.data.prospectId },
  });
  if (!prospect) return { ok: false, error: "Prospect introuvable" };
  if (!(await isWithinPromoterScope(me, prospect.programmeId))) {
    return { ok: false, error: "Prospect hors de votre périmètre" };
  }

  // Statut « qualifié » : prospect capable d'acheter mais avec délai.
  // On pose une échéance de relance par défaut à 3 mois (CDC évolution §2).
  const optionExpiresAt =
    parsed.data.status === "QUALIFIED"
      ? new Date(Date.now() + 3 * 30 * 24 * 3600_000)
      : null;

  await prisma.prospect.update({
    where: { id: parsed.data.prospectId },
    data: { status: parsed.data.status, optionExpiresAt },
  });
  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "Prospect",
    resourceId: parsed.data.prospectId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Statut du prospect modifié : ${prospect.status} → ${parsed.data.status}`,
  });
  revalidateAll();
  return { ok: true, value: undefined };
}

interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  phone?: string;
}

function parseCsv(csv: string): ImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines[0]!;
  const header = headerLine
    .split(/[,;]/)
    .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));

  function findIdx(...names: string[]): number {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxFirst = findIdx("prénom", "prenom", "first name", "firstname");
  const idxLast = findIdx("nom", "last name", "lastname");
  const idxEmail = findIdx(
    "email",
    "adresse e-mail",
    "adresse email",
    "e-mail",
  );
  const idxCity = findIdx("commune", "ville", "city");
  const idxPhone = findIdx("téléphone", "telephone", "phone", "tel");

  if (idxFirst === -1 || idxLast === -1 || idxEmail === -1) return [];

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const cells = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const firstName = cells[idxFirst];
    const lastName = cells[idxLast];
    const email = cells[idxEmail];
    if (!firstName || !lastName || !email) continue;
    rows.push({
      firstName,
      lastName,
      email: email.toLowerCase(),
      city: idxCity !== -1 ? cells[idxCity] : undefined,
      phone: idxPhone !== -1 ? cells[idxPhone] : undefined,
    });
  }
  return rows;
}

export async function importProspectsAction(
  input: ImportProspectsInput,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = importProspectsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  if (!(await isWithinPromoterScope(me, parsed.data.programmeId))) {
    return { ok: false, error: "Programme hors de votre périmètre" };
  }
  const ctx = await getRequestContext();
  const rows = parseCsv(parsed.data.csv);
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "Aucune ligne valide. Colonnes attendues : Prénom, Nom, Email, Commune.",
    };
  }

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      await prisma.prospect.create({
        data: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone || null,
          city: row.city || null,
          programmeId: parsed.data.programmeId || null,
          source: parsed.data.source || "google_forms",
          ownerId: me.role === "COLLABORATOR" ? me.id : null,
        },
      });
      imported++;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        skipped++;
        continue;
      }
      throw e;
    }
  }

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "Prospect",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Import de prospects depuis ${parsed.data.source || "google_forms"} : ${imported} importé(s), ${skipped} ignoré(s)`,
  });

  revalidateAll();
  return { ok: true, value: { imported, skipped } };
}

export async function deleteProspectAction(
  prospectId: string,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  if (!prospectId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });
  if (!prospect) return { ok: false, error: "Prospect introuvable" };
  if (!(await isWithinPromoterScope(me, prospect.programmeId))) {
    return { ok: false, error: "Prospect hors de votre périmètre" };
  }
  if (prospect.convertedDossierId) {
    return {
      ok: false,
      error: "Impossible de supprimer un prospect déjà converti.",
    };
  }
  await prisma.prospect.delete({ where: { id: prospectId } });
  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "Prospect",
    resourceId: prospectId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Prospect supprimé",
  });
  revalidateAll();
  return { ok: true, value: undefined };
}
