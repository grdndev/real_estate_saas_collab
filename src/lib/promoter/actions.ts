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
    metadata: { step: "treasury_entry", month: parsed.data.month },
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
    metadata: { via: "excel_import", reference, lotsCreated: lots.length },
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
