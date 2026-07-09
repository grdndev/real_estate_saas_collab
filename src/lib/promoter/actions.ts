"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findProgrammeForRole } from "@/lib/promoter/access";
import { getRequestContext } from "@/lib/request-context";
import {
  treasuryEntrySchema,
  importProgrammeSchema,
  type TreasuryEntryInput,
  type ImportProgrammeInput,
} from "@/lib/promoter/schemas";
import { parseLotsWorkbook } from "@/lib/promoter/excel-import";
import {
  buildProgrammeDocumentKey,
  deleteObject,
  isStorageConfigured,
  presignDownloadUrl,
  presignUploadUrl,
} from "@/lib/storage/s3";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/storage/schemas";
import type { ProgrammeDocumentCategory } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function computeTtc(priceHT: number, vatRate: number): Prisma.Decimal {
  return new Prisma.Decimal(priceHT)
    .times(1 + vatRate / 100)
    .toDecimalPlaces(2);
}

export async function upsertTreasuryEntryAction(
  input: TreasuryEntryInput,
): Promise<ActionResult> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const parsed = treasuryEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const programme = await findProgrammeForRole(
    parsed.data.programmeId,
    me.id,
    me.role,
  );
  if (!programme) return { ok: false, error: "Programme inaccessible." };

  const [year, month] = parsed.data.month
    .split("-")
    .map((s) => parseInt(s, 10));
  if (!year || !month) {
    return { ok: false, error: "Mois invalide" };
  }
  const monthDate = new Date(Date.UTC(year, month - 1, 1));

  const ctx = await getRequestContext();
  await prisma.tresoreriePrev.upsert({
    where: {
      programmeId_month: {
        programmeId: parsed.data.programmeId,
        month: monthDate,
      },
    },
    create: {
      programmeId: parsed.data.programmeId,
      month: monthDate,
      income: new Prisma.Decimal(parsed.data.income),
      expense: new Prisma.Decimal(parsed.data.expense),
    },
    update: {
      income: new Prisma.Decimal(parsed.data.income),
      expense: new Prisma.Decimal(parsed.data.expense),
    },
  });

  await audit({
    userId: me.id,
    action: "PROGRAMME_UPDATED",
    resourceType: "Programme",
    resourceId: parsed.data.programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Trésorerie du mois ${parsed.data.month} saisie (programme ${parsed.data.programmeId})`,
  });

  revalidatePath(`/promoteur/${parsed.data.programmeId}/tresorerie`);
  return { ok: true, value: undefined };
}

// =====================================================
// IMPORT PROGRAMME + LOTS VIA FICHIER EXCEL
// =====================================================

export async function importProgrammeAction(
  input: ImportProgrammeInput,
): Promise<
  ActionResult<{ programmeId: string; lotsCreated: number; warnings: string[] }>
> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const parsed = importProgrammeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.fileB64, "base64");
  } catch {
    return { ok: false, error: "Fichier illisible." };
  }

  const { lots, errors } = await parseLotsWorkbook(buffer);
  if (lots.length === 0) {
    return {
      ok: false,
      error:
        errors[0] ??
        "Aucun lot n'a pu être extrait du fichier. Vérifiez les colonnes.",
    };
  }

  const reference = parsed.data.reference.toUpperCase();
  const existing = await prisma.programme.findUnique({ where: { reference } });
  if (existing) {
    return {
      ok: false,
      error: "Cette référence de programme est déjà utilisée.",
    };
  }

  // CA objectif prévisionnel = somme des prix TTC importés.
  const caObjective = lots.reduce(
    (acc, l) => acc.plus(computeTtc(l.priceHT, l.vatRate)),
    new Prisma.Decimal(0),
  );

  const programme = await prisma.$transaction(async (tx) => {
    const prog = await tx.programme.create({
      data: {
        reference,
        name: parsed.data.name,
        city: parsed.data.city || null,
        caObjective,
        totalLots: lots.length,
      },
    });
    await tx.lot.createMany({
      data: lots.map((l) => ({
        programmeId: prog.id,
        reference: l.reference,
        surface: new Prisma.Decimal(l.surface),
        floor: l.floor,
        type: l.type,
        priceHT: new Prisma.Decimal(l.priceHT),
        vatRate: new Prisma.Decimal(l.vatRate),
        priceTTC: computeTtc(l.priceHT, l.vatRate),
        status: l.status,
      })),
    });
    // Le programme importé est rattaché à son promoteur (visible par tous
    // les collaborateurs du cabinet de toute façon).
    if (me.role === "PROMOTER") {
      await tx.programmePromoter.create({
        data: { programmeId: prog.id, promoterId: me.id },
      });
    }
    return prog;
  });

  await audit({
    userId: me.id,
    action: "PROGRAMME_CREATED",
    resourceType: "Programme",
    resourceId: programme.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Programme ${reference} créé par import Excel (${lots.length} lots)`,
  });

  revalidatePath("/promoteur");
  revalidatePath("/admin/programmes");
  return {
    ok: true,
    value: {
      programmeId: programme.id,
      lotsCreated: lots.length,
      warnings: errors,
    },
  };
}

// =====================================================
// PROGRAMME DOCUMENTS
// =====================================================

const prepareProgrammeDocumentSchema = z.object({
  programmeId: z.string().min(1),
  category: z.enum(["PLAN", "PERMIS", "NOTICE", "BUDGET", "ACTE"]),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME, {
    error: () => ({
      message: "Format non autorisé. Acceptés : PDF, JPG, PNG, DOCX.",
    }),
  }),
  sizeBytes: z
    .number()
    .int()
    .min(1, "Fichier vide")
    .max(MAX_FILE_BYTES, "Fichier > 20 Mo"),
});

export async function prepareProgrammeDocumentUploadAction(input: {
  programmeId: string;
  category: ProgrammeDocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ActionResult<{ documentId: string; uploadUrl: string }>> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const parsed = prepareProgrammeDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  if (!isStorageConfigured()) {
    return { ok: false, error: "Stockage S3 non configuré." };
  }
  const programme = await findProgrammeForRole(
    parsed.data.programmeId,
    me.id,
    me.role,
  );
  if (!programme) return { ok: false, error: "Programme inaccessible." };

  const doc = await prisma.programmeDocument.create({
    data: {
      programmeId: parsed.data.programmeId,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      category: parsed.data.category,
      storageKey: "_pending_",
    },
  });
  const storageKey = buildProgrammeDocumentKey(parsed.data.programmeId, doc.id);
  await prisma.programmeDocument.update({
    where: { id: doc.id },
    data: { storageKey },
  });

  const uploadUrl = await presignUploadUrl(
    storageKey,
    parsed.data.mimeType,
    parsed.data.sizeBytes,
  );

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "ProgrammeDocument",
    resourceId: doc.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dépôt d'un document de programme (programme ${parsed.data.programmeId}, catégorie ${parsed.data.category})`,
  });

  return { ok: true, value: { documentId: doc.id, uploadUrl } };
}

export async function confirmProgrammeDocumentUploadAction(
  documentId: string,
): Promise<ActionResult> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const doc = await prisma.programmeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  const programme = await findProgrammeForRole(doc.programmeId, me.id, me.role);
  if (!programme) return { ok: false, error: "Accès refusé." };

  revalidatePath(`/promoteur/${doc.programmeId}`);
  return { ok: true, value: undefined };
}

export async function deleteProgrammeDocumentAction(
  documentId: string,
): Promise<ActionResult> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const doc = await prisma.programmeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  const programme = await findProgrammeForRole(doc.programmeId, me.id, me.role);
  if (!programme) return { ok: false, error: "Accès refusé." };

  await prisma.programmeDocument.delete({ where: { id: documentId } });
  void deleteObject(doc.storageKey).catch((err) => {
    console.error("[storage] échec suppression S3", doc.storageKey, err);
  });

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "DOCUMENT_DELETED",
    resourceType: "ProgrammeDocument",
    resourceId: documentId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Document de programme supprimé (programme ${doc.programmeId})`,
  });

  revalidatePath(`/promoteur/${doc.programmeId}`);
  return { ok: true, value: undefined };
}

export async function getProgrammeDocumentDownloadUrlAction(
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  if (!isStorageConfigured())
    return { ok: false, error: "Stockage S3 non configuré." };

  const doc = await prisma.programmeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  const programme = await findProgrammeForRole(doc.programmeId, me.id, me.role);
  if (!programme) return { ok: false, error: "Accès refusé." };

  const ctx = await getRequestContext();
  const url = await presignDownloadUrl(doc.storageKey, doc.fileName);

  await audit({
    userId: me.id,
    action: "DOCUMENT_DOWNLOADED",
    resourceType: "ProgrammeDocument",
    resourceId: documentId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Document de programme « ${doc.fileName} » téléchargé (programme ${doc.programmeId})`,
  });

  return { ok: true, value: { url } };
}
