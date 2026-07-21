"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import type { ActionResult } from "@/lib/auth/actions";
import {
  parseTrackingFileSchema,
  createTrackingProgrammeSchema,
  importTrackingLotsSchema,
  createTrackingDossierSchema,
} from "@/lib/collaborateur/tracking-import-schemas";
import { parseTrackingWorkbook } from "@/lib/collaborateur/tracking-import";
import type { ParsedTrackingLot } from "@/lib/collaborateur/tracking-import-types";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// ACTION 1 : parse
// ---------------------------------------------------------------------------

export async function parseTrackingFileAction(
  fileB64: string,
): Promise<ActionResult<{ rows: ParsedTrackingLot[]; errors: string[] }>> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN", "PROMOTER"]);

  const parsed = parseTrackingFileSchema.safeParse({ fileB64 });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Fichier invalide.",
      fieldErrors: flatten(parsed.error),
    };
  }

  const buffer = Buffer.from(parsed.data.fileB64, "base64");
  const result = await parseTrackingWorkbook(buffer);
  return { ok: true, value: result };
}

// ---------------------------------------------------------------------------
// ACTION 2 : programme
// ---------------------------------------------------------------------------

export async function createTrackingProgrammeAction(
  input: unknown,
): Promise<ActionResult<{ programmeId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN", "PROMOTER"]);
  const parsed = createTrackingProgrammeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide.",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  if (data.mode === "existing") {
    const prog = await prisma.programme.findUnique({
      where: { id: data.programmeId! },
    });
    if (!prog || prog.status !== "ACTIVE") {
      return { ok: false, error: "Programme introuvable ou inactif." };
    }
    await audit({
      userId: me.id,
      action: "PROGRAMME_UPDATED",
      resourceType: "Programme",
      resourceId: prog.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: `Programme ${prog.name} sélectionné pour l'import d'un fichier de suivi`,
    });
    return { ok: true, value: { programmeId: prog.id } };
  }

  // mode = "new"
  try {
    const prog = await prisma.$transaction(async (tx) => {
      const created = await tx.programme.create({
        data: {
          name: data.name!,
          zipcode: data.zipcode ?? null,
          city: data.city ?? null,
          status: "ACTIVE",
        },
      });
      // Un programme créé par un promoteur lui est rattaché.
      if (me.role === "PROMOTER") {
        await tx.programmePromoter.create({
          data: { programmeId: created.id, promoterId: me.id },
        });
      }
      return created;
    });
    await audit({
      userId: me.id,
      action: "PROGRAMME_CREATED",
      resourceType: "Programme",
      resourceId: prog.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: `Programme ${prog.name} créé via l'import d'un fichier de suivi`,
    });
    return { ok: true, value: { programmeId: prog.id } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Un programme porte déjà ce nom.",
        fieldErrors: { name: ["Nom déjà pris."] },
      };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ACTION 3 : lots
// ---------------------------------------------------------------------------

export async function importTrackingLotsAction(
  input: unknown,
): Promise<ActionResult<{ upserted: number; lotIds: Record<string, string> }>> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN", "PROMOTER"]);

  const parsed = importTrackingLotsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide.",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { programmeId, lots } = parsed.data;

  const lotIds: Record<string, string> = {};
  let upserted = 0;

  const toDecimal = (n: number | null) =>
    n == null ? null : new Prisma.Decimal(n);

  for (const lot of lots) {
    const vatRate = new Prisma.Decimal(lot.vatRate);
    const priceHT = new Prisma.Decimal(lot.priceHT);
    // TTC importé du fichier (colonne "Prix FAI"), conservé tel quel.
    const priceTTC = new Prisma.Decimal(lot.priceTTC);

    const extraFields = {
      building: lot.building,
      annexSurface: toDecimal(lot.annexSurface),
      garden: toDecimal(lot.garden),
      priceNetVendeur: toDecimal(lot.priceNetVendeur),
      priceNetVendeurWithParking: toDecimal(lot.priceNetVendeurWithParking),
      commissionAgence: toDecimal(lot.commissionAgence),
      commissionAgenceParking: toDecimal(lot.commissionAgenceParking),
      priceLocation: toDecimal(lot.priceLocation),
      creditImpot35: toDecimal(lot.creditImpot35),
      priceRevientCrdImp: toDecimal(lot.priceRevientCrdImp),
      additionalParking: lot.additionalParking,
    };

    const result = await prisma.lot.upsert({
      where: {
        programmeId_reference: { programmeId, reference: lot.reference },
      },
      create: {
        programmeId,
        reference: lot.reference,
        floor: lot.floor,
        type: lot.type,
        surface: new Prisma.Decimal(lot.surface),
        priceHT,
        vatRate,
        priceTTC,
        notes: lot.notes,
        status: "AVAILABLE",
        ...extraFields,
      },
      update: {
        floor: lot.floor,
        type: lot.type,
        surface: new Prisma.Decimal(lot.surface),
        priceHT,
        vatRate,
        priceTTC,
        notes: lot.notes,
        ...extraFields,
      },
      select: { id: true, reference: true },
    });

    lotIds[result.reference] = result.id;
    upserted++;
  }

  // Sync totalLots count
  const count = await prisma.lot.count({ where: { programmeId } });
  await prisma.programme.update({
    where: { id: programmeId },
    data: { totalLots: count },
  });

  return { ok: true, value: { upserted, lotIds } };
}

// ---------------------------------------------------------------------------
// ACTION 4 : dossier
// ---------------------------------------------------------------------------

export async function upsertTrackingDossierAction(
  input: unknown,
): Promise<ActionResult<{ dossierId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN", "PROMOTER"]);

  const parsed = createTrackingDossierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide.",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { programmeId, lotId, lotFinalStatus, processData, client } =
    parsed.data;
  const ctx = await getRequestContext();

  const programme = await prisma.programme.findUnique({
    where: { id: programmeId },
  });
  if (!programme || programme.status !== "ACTIVE") {
    return { ok: false, error: "Programme invalide." };
  }

  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot || lot.programmeId !== programmeId) {
    return { ok: false, error: "Lot incompatible avec ce programme." };
  }

  const clientId = client?.existingUserId ?? null;

  let existingDossier = lot.dossierId
    ? await prisma.dossier.findUnique({ where: { id: lot.dossierId } })
    : null;

  if (clientId) {
    const user = await prisma.user.findUnique({ where: { id: clientId } });
    if (!user || user.role !== "CLIENT") {
      return { ok: false, error: "Client introuvable ou rôle invalide." };
    }
    const clientDossier = await prisma.dossier.findUnique({
      where: { clientId },
    });
    if (clientDossier && clientDossier.id !== (existingDossier?.id ?? "")) {
      await prisma.lot.update({
        where: { id: lotId },
        data: { dossierId: clientDossier.id },
      });
      existingDossier = clientDossier;
    }
  }

  // Infer dossier status
  const actSignedAt = toDate(processData.actSignedAt);
  const notaryTransmittedAt = toDate(processData.notaryTransmittedAt);
  const reservationSignedAt = toDate(processData.reservationSignedAt);
  const optionDate = toDate(processData.optionDate);
  const guaranteeDepositReceivedAt = toDate(
    processData.guaranteeDepositReceivedAt,
  );
  const reservationEndDate = toDate(processData.reservationEndDate);
  const kbisObtainedAt = toDate(processData.kbisObtainedAt);
  const deposit200ReceivedAt = toDate(processData.deposit200ReceivedAt);
  const rarSentByNotaryAt = toDate(processData.rarSentByNotaryAt);
  const loanFiledAt = toDate(processData.loanFiledAt);
  const loanObtainedAt = toDate(processData.loanObtainedAt);
  const guaranteeDepositAmount =
    processData.guaranteeDepositAmount != null
      ? new Prisma.Decimal(processData.guaranteeDepositAmount)
      : null;

  const extraDossierFields = {
    observation: processData.observation,
    financingMode: processData.financingMode,
    reservationSignedAt,
    guaranteeDepositAmount,
    guaranteeDepositReceivedAt,
    reservationEndDate,
    actSignedAt,
    kbisObtainedAt,
    clientAtRsm: processData.clientAtRsm,
    deposit200ReceivedAt,
    rarSentByNotaryAt,
    loanFiledAt,
    loanObtainedAt,
  };
  // L'expiration de l'option est la fin de réservation ; à défaut, la date
  // de prise d'option (mieux vaut une option affichée expirée qu'aucune date).
  const optionExpiry = reservationEndDate ?? optionDate;

  type DS = "NEW_LEAD" | "RESERVATION_SENT" | "SIGNED_AT_NOTARY" | "ACT_SIGNED";
  let dossierStatus: DS = "NEW_LEAD";
  if (actSignedAt) dossierStatus = "ACT_SIGNED";
  else if (notaryTransmittedAt) dossierStatus = "SIGNED_AT_NOTARY";
  else if (reservationSignedAt) dossierStatus = "RESERVATION_SENT";

  type CS =
    | "AWAITING_SIGNATURE"
    | "CONTRACT_SIGNED"
    | "SENT_TO_NOTARY"
    | "LOAN_OFFER_RECEIVED";
  let contractStatus: CS | null = null;
  if (!actSignedAt) {
    if (notaryTransmittedAt) contractStatus = "SENT_TO_NOTARY";
    else if (processData.loanObtained === "cash") contractStatus = null;
    else if (processData.loanObtained) contractStatus = "LOAN_OFFER_RECEIVED";
    else if (reservationSignedAt) contractStatus = "CONTRACT_SIGNED";
    else contractStatus = "AWAITING_SIGNATURE";
  }

  const optioned = !!optionDate && !reservationSignedAt;

  // Timeline events (shared between create and update paths)
  const events: {
    date: Date;
    kind: string;
    title: string;
    description?: string;
  }[] = [];

  if (optionDate)
    events.push({
      date: optionDate,
      kind: "OPTION_TAKEN",
      title: "Option posée (import)",
    });
  if (reservationSignedAt)
    events.push({
      date: reservationSignedAt,
      kind: "RESERVATION_SIGNED",
      title: "Contrat de réservation signé (import)",
    });
  if (notaryTransmittedAt)
    events.push({
      date: notaryTransmittedAt,
      kind: "TRANSMITTED_TO_NOTARY",
      title: "Envoyé chez le notaire (import)",
    });
  if (guaranteeDepositReceivedAt)
    events.push({
      date: guaranteeDepositReceivedAt,
      kind: "GUARANTEE_DEPOSIT_RECEIVED",
      title: "Dépôt de garantie reçu (import)",
      description: processData.guaranteeDepositAmount
        ? `${processData.guaranteeDepositAmount.toLocaleString("fr-FR")} €`
        : undefined,
    });
  if (actSignedAt)
    events.push({
      date: actSignedAt,
      kind: "ACT_SIGNED",
      title: "Acte signé (import)",
    });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (existingDossier) {
    // --- Cas A : mise à jour ---
    const STATUS_ORDER = [
      "NEW_LEAD",
      "RESERVATION_SENT",
      "SIGNED_AT_NOTARY",
      "ACT_SIGNED",
    ];
    const currentRank = STATUS_ORDER.indexOf(existingDossier.status);
    const newRank = STATUS_ORDER.indexOf(dossierStatus);
    const effectiveStatus =
      newRank > currentRank ? dossierStatus : existingDossier.status;

    await prisma.$transaction(async (tx) => {
      await tx.dossier.update({
        where: { id: existingDossier.id },
        data: {
          clientId,
          status: effectiveStatus,
          contractStatus,
          optioned,
          optionExpiresAt: optioned ? optionExpiry : null,
          notaryTransmittedAt,
          closedAt: actSignedAt ?? null,
          ...extraDossierFields,
        },
      });

      await tx.lot.update({
        where: { id: lotId },
        data: { status: lotFinalStatus },
      });

      const existing = await tx.timelineEvent.findMany({
        where: { dossierId: existingDossier.id },
        select: { kind: true },
      });
      const existingKinds = new Set(existing.map((e) => e.kind));

      for (const ev of events) {
        if (!existingKinds.has(ev.kind as never)) {
          await tx.timelineEvent.create({
            data: {
              dossierId: existingDossier.id,
              kind: ev.kind as never,
              title: ev.title,
              description: ev.description ?? null,
              actorId: me.id,
            },
          });
        }
      }
    });

    await audit({
      userId: me.id,
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: existingDossier.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: `Dossier mis à jour via l'import d'un fichier de suivi (programme ${programmeId})`,
    });

    revalidatePath("/collaborateur");
    revalidatePath("/collaborateur/dossiers");

    return { ok: true, value: { dossierId: existingDossier.id } };
  }

  // --- Cas B : création ---
  const dossier = await prisma.$transaction(async (tx) => {
    const created = await tx.dossier.create({
      data: {
        programmeId,
        clientId,
        status: dossierStatus,
        contractStatus,
        optioned,
        optionExpiresAt: optioned ? optionExpiry : null,
        notaryTransmittedAt,
        closedAt: actSignedAt ?? null,
        ...extraDossierFields,
      },
    });

    await tx.dossierParticipant.create({
      data: {
        dossierId: created.id,
        userId: me.id,
        role: "COLLABORATOR_PRIMARY",
      },
    });

    await tx.lot.update({
      where: { id: lotId },
      data: { dossierId: created.id, status: lotFinalStatus },
    });

    for (const ev of events) {
      await tx.timelineEvent.create({
        data: {
          dossierId: created.id,
          kind: ev.kind as never,
          title: ev.title,
          description: ev.description ?? null,
          actorId: me.id,
        },
      });
    }

    // Final CUSTOM event for import trace
    await tx.timelineEvent.create({
      data: {
        dossierId: created.id,
        kind: "CUSTOM",
        title: "Import tableau de suivi",
        description: processData.financingMode ?? null,
        actorId: me.id,
      },
    });

    // Observation → Note
    if (processData.observation) {
      await tx.note.create({
        data: {
          scope: "DOSSIER",
          dossierId: created.id,
          authorId: me.id,
          body: processData.observation,
        },
      });
    }

    return created;
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dossier créé via l'import d'un fichier de suivi (programme ${programmeId})`,
  });

  revalidatePath("/collaborateur");
  revalidatePath("/collaborateur/dossiers");

  return { ok: true, value: { dossierId: dossier.id } };
}

// ---------------------------------------------------------------------------
// HELPER : lookup client by email
// ---------------------------------------------------------------------------

export async function lookupClientByEmailAction(
  email: string,
): Promise<ActionResult<{ userId: string | null; hasDossier: boolean }>> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN", "PROMOTER"]);

  if (!email) return { ok: true, value: { userId: null, hasDossier: false } };

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "CLIENT") {
    return { ok: true, value: { userId: null, hasDossier: false } };
  }

  // Check if client already has a dossier
  const existing = await prisma.dossier.findUnique({
    where: { clientId: user.id },
    select: { id: true },
  });

  if (existing) {
    return { ok: true, value: { userId: user.id, hasDossier: true } };
  }

  return { ok: true, value: { userId: user.id, hasDossier: false } };
}
