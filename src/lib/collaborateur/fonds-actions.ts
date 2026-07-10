"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
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
      numero: z.number(),
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
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  const { lotId, appels, notes, ...fields } = parsed.data;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { programmeId: true, reference: true },
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

  const [fondsUpserted] = await Promise.all([
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
    await prisma.appelFonds.upsert({
      where: {
        lotFondsId_numero: {
          lotFondsId: fondsUpserted.id,
          numero: appel.numero,
        },
      },
      create: {
        lotFondsId: fondsUpserted.id,
        numero: appel.numero,
        label: "",
        pourcentage: new Prisma.Decimal(0),
        montant: new Prisma.Decimal(appel.montant),
        datePrevue: appel.datePrevue,
      },
      update: {
        montant: new Prisma.Decimal(appel.montant),
        datePrevue: appel.datePrevue,
      },
    });
  }

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "FONDS_UPDATED",
    resourceType: "LotFondsSuivi",
    resourceId: fondsUpserted.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Suivi des fonds mis à jour pour le lot ${lot.reference} (${appels.length} appel(s) de fonds)`,
  });

  revalidatePath("/collaborateur/fonds");
  revalidatePath(`/collaborateur/fonds/${lotId}`);
  revalidatePath("/admin/fonds");
  revalidatePath(`/admin/fonds/${lotId}`);

  return { ok: true, value: undefined };
}

export async function upsertProgrammeAppelAction(input: {
  programmeId: string;
  numero: number;
  label: string;
  pourcentage: number;
  datePrevue: string | null;
}): Promise<ActionResult<void>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const lotsFonds = await prisma.lotFondsSuivi.findMany({
    where: { programmeId: input.programmeId },
  });

  for (const lfs of lotsFonds) {
    await prisma.appelFonds.upsert({
      where: {
        lotFondsId_numero: { lotFondsId: lfs.id, numero: input.numero },
      },
      create: {
        lotFondsId: lfs.id,
        numero: input.numero,
        label: input.label,
        pourcentage: new Prisma.Decimal(input.pourcentage),
        montant: new Prisma.Decimal(0),
        datePrevue: input.datePrevue,
      },
      update: {
        label: input.label,
        pourcentage: new Prisma.Decimal(input.pourcentage),
        datePrevue: input.datePrevue,
      },
    });
  }

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "FONDS_UPDATED",
    resourceType: "Programme",
    resourceId: input.programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Appel de fonds n°${input.numero} « ${input.label} » défini sur ${lotsFonds.length} lot(s)`,
  });

  revalidatePath("/collaborateur/fonds");
  revalidatePath("/admin/fonds");

  return { ok: true, value: undefined };
}

export async function deleteProgrammeAppelAction(input: {
  programmeId: string;
  numero: number;
}): Promise<ActionResult<void>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  await prisma.appelFonds.deleteMany({
    where: {
      numero: input.numero,
      lotFonds: { programmeId: input.programmeId },
    },
  });

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "FONDS_UPDATED",
    resourceType: "Programme",
    resourceId: input.programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Appel de fonds n°${input.numero} supprimé du programme`,
  });

  revalidatePath("/collaborateur/fonds");
  revalidatePath("/admin/fonds");

  return { ok: true, value: undefined };
}
