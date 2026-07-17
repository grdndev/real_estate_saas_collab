"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth/guards";
import { programmesForPromoter } from "@/lib/promoter/access";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import { hashPassword } from "@/lib/auth/password";
import { generateDossierReference } from "@/lib/dossier/reference";
import { createClientDossierCore } from "@/lib/dossier/client-dossier-core";
import { getMailer } from "@/lib/mail";
import { invitationMail } from "@/lib/mail/admin-templates";
import {
  createProspectSchema,
  importProspectsSchema,
  updateProspectStatusSchema,
  convertProspectSchema,
  revertProspectConversionSchema,
  type CreateProspectInput,
  type ImportProspectsInput,
  type UpdateProspectStatusInput,
  type ConvertProspectInput,
  type RevertProspectConversionInput,
  type ProspectStatusInput,
} from "@/lib/prospect/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// Chaîne ordonnée du cycle de vie prospect (hors CONVERTED/DROPPED).
const ORDERED_CHAIN = ["NEW", "QUALIFIED", "OPTIONED"] as const;
type ChainStatus = (typeof ORDERED_CHAIN)[number];
const inChain = (s: ProspectStatusInput): s is ChainStatus =>
  (ORDERED_CHAIN as readonly string[]).includes(s);

/**
 * Transitions gérées par `updateProspectStatusAction` :
 *  - déplacement d'exactement ±1 cran entre NEW(0) ↔ QUALIFIED(1) ↔ OPTIONED(2) ;
 *  - abandon (→ DROPPED) depuis n'importe quel stade de la chaîne ;
 *  - réactivation DROPPED → NEW.
 * Tout mouvement vers/depuis CONVERTED est interdit ici (conversion dédiée).
 */
function isAllowedStatusTransition(
  from: ProspectStatusInput,
  to: ProspectStatusInput,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: false, error: "Le prospect a déjà ce statut." };

  if (from === "CONVERTED" || to === "CONVERTED") {
    return {
      ok: false,
      error:
        "Utilisez « Convertir en client » ou « Annuler la conversion » pour un client.",
    };
  }

  if (to === "DROPPED") {
    return inChain(from)
      ? { ok: true }
      : { ok: false, error: "Transition non autorisée." };
  }

  if (from === "DROPPED") {
    return to === "NEW"
      ? { ok: true }
      : {
          ok: false,
          error:
            "Un prospect abandonné ne peut être réactivé qu'au stade « Prospect ».",
        };
  }

  if (!inChain(from) || !inChain(to)) {
    return { ok: false, error: "Transition non autorisée." };
  }
  if (Math.abs(ORDERED_CHAIN.indexOf(to) - ORDERED_CHAIN.indexOf(from)) !== 1) {
    return {
      ok: false,
      error: "Un prospect ne peut avancer ou reculer que d'un stade à la fois.",
    };
  }
  return { ok: true };
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

  const from = prospect.status;
  const to = parsed.data.status;

  // Cycle de vie ordonné : NEW(0) → QUALIFIED(1) → OPTIONED(2) → CONVERTED(3).
  // Cette action ne gère QUE les mouvements réversibles d'un cran entre 0/1/2,
  // l'abandon (DROPPED) et la réactivation. Le passage à/depuis CONVERTED est
  // réservé aux actions de conversion dédiées.
  const check = isAllowedStatusTransition(from, to);
  if (!check.ok) return { ok: false, error: check.error };

  // Statut « qualifié » : prospect capable d'acheter mais avec délai.
  // On pose une échéance de relance par défaut à 3 mois (CDC évolution §2).
  const optionExpiresAt =
    to === "QUALIFIED" ? new Date(Date.now() + 3 * 30 * 24 * 3600_000) : null;

  await prisma.prospect.update({
    where: { id: parsed.data.prospectId },
    data: { status: to, optionExpiresAt },
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

// Timeline « initiale » d'un dossier tout juste créé (aucune activité réelle).
const INITIAL_TIMELINE_KINDS = new Set(["LEAD_CREATED", "STATUS_CHANGE"]);

// =====================================================
// CONVERSION EN CLIENT (prospect réservataire → client + dossier)
// =====================================================

export async function convertProspectAction(
  input: ConvertProspectInput,
): Promise<ActionResult<{ dossierId: string; reference: string }>> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = convertProspectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const prospect = await prisma.prospect.findUnique({
    where: { id: data.prospectId },
  });
  if (!prospect) return { ok: false, error: "Prospect introuvable" };
  // Cloisonnement : le promoteur doit avoir accès au programme cible.
  if (!(await isWithinPromoterScope(me, data.programmeId))) {
    return { ok: false, error: "Programme hors de votre périmètre" };
  }
  if (prospect.convertedDossierId) {
    return { ok: false, error: "Ce prospect est déjà converti." };
  }
  if (prospect.status !== "OPTIONED") {
    return {
      ok: false,
      error: "Seul un prospect réservataire peut être converti en client.",
    };
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
      return { ok: false, error: "Lot incompatible avec ce programme." };
    }
    if (lot.status !== "AVAILABLE") {
      return { ok: false, error: "Ce lot n'est plus disponible." };
    }
  }

  const email = prospect.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      ok: false,
      error:
        "Un compte existe déjà avec l'email de ce prospect. Associez-le manuellement à un dossier.",
    };
  }

  // Collaborateur référent : l'acteur s'il est collaborateur, sinon l'owner du
  // prospect s'il en est un. Sinon aucun (assignable plus tard) — cas d'un
  // promoteur convertissant un prospect sans owner.
  let collaboratorId: string | null = me.role === "COLLABORATOR" ? me.id : null;
  if (!collaboratorId && prospect.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: prospect.ownerId },
    });
    if (owner && owner.role === "COLLABORATOR" && owner.status === "ACTIVE") {
      collaboratorId = owner.id;
    }
  }

  const reference = await generateDossierReference();
  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const core = await createClientDossierCore(tx, {
        email,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        phone: prospect.phone,
        programmeId: data.programmeId,
        lotId: data.lotId ?? null,
        reference,
        passwordHash: placeholderHash,
        collaboratorId,
        actorId: me.id,
        timelineTitle: "Dossier créé par conversion d'un prospect",
        initialNote: null,
      });
      await tx.prospect.update({
        where: { id: prospect.id },
        data: {
          status: "CONVERTED",
          convertedDossierId: core.dossier.id,
          optionExpiresAt: null,
        },
      });
      return core;
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Un compte existe déjà avec l'email de ce prospect.",
      };
    }
    throw e;
  }

  // Email d'invitation au client (hors transaction, best-effort).
  try {
    await getMailer().send(
      invitationMail(
        created.user.email,
        created.user.firstName,
        "CLIENT",
        created.token,
      ),
    );
  } catch (err) {
    console.error("[mail] convertProspect invitation", err);
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: created.dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Prospect ${prospect.id} converti en client (dossier ${reference})`,
  });

  revalidateAll();
  revalidatePath("/collaborateur/dossiers");
  return {
    ok: true,
    value: { dossierId: created.dossier.id, reference },
  };
}

// =====================================================
// RETOUR DE CONVERSION (client → prospect réservataire)
// =====================================================

export async function revertProspectConversionAction(
  input: RevertProspectConversionInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = revertProspectConversionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  const ctx = await getRequestContext();

  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.data.prospectId },
  });
  if (!prospect) return { ok: false, error: "Prospect introuvable" };
  if (!(await isWithinPromoterScope(me, prospect.programmeId))) {
    return { ok: false, error: "Prospect hors de votre périmètre" };
  }
  if (prospect.status !== "CONVERTED" || !prospect.convertedDossierId) {
    return { ok: false, error: "Ce prospect n'est pas converti." };
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: prospect.convertedDossierId },
    select: {
      id: true,
      clientId: true,
      lots: { select: { id: true } },
      timelineEvents: { select: { kind: true } },
      _count: {
        select: {
          documents: true,
          signatures: true,
          messages: true,
          invoices: true,
        },
      },
    },
  });

  // Dossier introuvable (déjà supprimé) : on se contente de remettre le prospect
  // au stade réservataire (le lien a été dénoué par onDelete: SetNull).
  if (!dossier) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: "OPTIONED", convertedDossierId: null },
    });
    revalidateAll();
    return { ok: true, value: undefined };
  }

  const nonInitialEvents = dossier.timelineEvents.filter(
    (e) => !INITIAL_TIMELINE_KINDS.has(e.kind),
  ).length;
  const hasActivity =
    dossier._count.documents > 0 ||
    dossier._count.signatures > 0 ||
    dossier._count.messages > 0 ||
    dossier._count.invoices > 0 ||
    nonInitialEvents > 0;

  if (hasActivity) {
    return {
      ok: false,
      error:
        "Annulation impossible : le dossier a déjà de l'activité (documents, messages, signatures, factures ou événements).",
    };
  }

  const clientId = dossier.clientId;

  await prisma.$transaction(async (tx) => {
    // Dénouer le prospect avant la suppression du dossier.
    await tx.prospect.update({
      where: { id: prospect.id },
      data: { status: "OPTIONED", convertedDossierId: null },
    });
    // Libérer les lots réservés (pas de cascade sur Lot.dossierId).
    if (dossier.lots.length > 0) {
      await tx.lot.updateMany({
        where: { dossierId: dossier.id },
        data: { dossierId: null, status: "AVAILABLE" },
      });
    }
    // Supprimer le dossier vide (cascade : participants, pièces demandées,
    // timeline, etc.).
    await tx.dossier.delete({ where: { id: dossier.id } });
    // Supprimer le compte client créé par la conversion s'il n'est rattaché à
    // aucun autre dossier.
    if (clientId) {
      const other = await tx.dossier.findFirst({ where: { clientId } });
      if (!other) {
        await tx.user.delete({ where: { id: clientId } });
      }
    }
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "Prospect",
    resourceId: prospect.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Conversion annulée : dossier ${dossier.id} supprimé, prospect repassé réservataire`,
  });

  revalidateAll();
  revalidatePath("/collaborateur/dossiers");
  return { ok: true, value: undefined };
}
