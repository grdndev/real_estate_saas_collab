"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import type { ActionResult } from "@/lib/auth/actions";

const updateSchema = z.object({
  lotId: z.string().min(1),
  commission: z.number().nullable(),
  fraisMainLevee: z.number().nullable(),
  rbstEdd: z.number().nullable(),
  soldeVendeur: z.number().nullable(),
  dateEnvoiLr: z.string().nullable(),
  dateReceptionLr: z.string().nullable(),
  dateReceptionVirement: z.string().nullable(),
  notes: z.string().nullable(),
  appels: z.array(
    z.object({
      id: z.string(),
      montant: z.number(),
      datePrevue: z.string().nullable(),
    }),
  ),
});

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateLotFondsSuiviAction(
  input: unknown,
): Promise<ActionResult<void>> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  const { lotId, appels, notes, ...fields } = parsed.data;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { programmeId: true },
  });
  if (!lot) return { ok: false, error: "Lot introuvable." };

  const fondsData = {
    commission:
      fields.commission != null ? new Prisma.Decimal(fields.commission) : null,
    fraisMainLevee:
      fields.fraisMainLevee != null
        ? new Prisma.Decimal(fields.fraisMainLevee)
        : null,
    rbstEdd: fields.rbstEdd != null ? new Prisma.Decimal(fields.rbstEdd) : null,
    soldeVendeur:
      fields.soldeVendeur != null
        ? new Prisma.Decimal(fields.soldeVendeur)
        : null,
    dateEnvoiLr: toDate(fields.dateEnvoiLr),
    dateReceptionLr: toDate(fields.dateReceptionLr),
    dateReceptionVirement: toDate(fields.dateReceptionVirement),
  };

  await Promise.all([
    prisma.lotFondsSuivi.upsert({
      where: { lotId },
      create: { lotId, programmeId: lot.programmeId, ...fondsData },
      update: fondsData,
    }),
    prisma.lot.update({
      where: { id: lotId },
      data: { notes: notes || null },
    }),
  ]);

  for (const appel of appels) {
    await prisma.appelFonds.update({
      where: { id: appel.id },
      data: {
        montant: new Prisma.Decimal(appel.montant),
        datePrevue: appel.datePrevue || null,
      },
    });
  }

  revalidatePath("/collaborateur/fonds");
  revalidatePath(`/collaborateur/fonds/${lotId}`);

  return { ok: true, value: undefined };
}
