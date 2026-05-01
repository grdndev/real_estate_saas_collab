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
  type TreasuryEntryInput,
} from "@/lib/promoter/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
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
