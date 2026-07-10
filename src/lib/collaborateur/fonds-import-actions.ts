"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import type { ActionResult } from "@/lib/auth/actions";
import { parseFondsWorkbook } from "@/lib/collaborateur/fonds-import";
import type {
  ParsedFondsLot,
  ParsedFondsAppelType,
} from "@/lib/collaborateur/fonds-import-types";

const parseFileSchema = z.object({
  fileB64: z.string().min(1),
});

const appelTypeSchema = z.object({
  numero: z.number(),
  label: z.string(),
  mois: z.string(),
  annee: z.number(),
  pourcentage: z.number(),
});

const importSchema = z.object({
  programmeId: z.string().min(1),
  appelTypes: z.array(appelTypeSchema),
  rows: z.array(
    z.object({
      lotReference: z.string(),
      nomAcquereur: z.string().nullable(),
      dateSignatureActe: z.string().nullable(),
      commission: z.number().nullable(),
      fraisMainLevee: z.number().nullable(),
      rbstEdd: z.number().nullable(),
      soldeVendeur: z.number().nullable(),
      dateEnvoiLr: z.string().nullable(),
      dateReceptionLr: z.string().nullable(),
      dateReceptionVirement: z.string().nullable(),
      notes: z.string().nullable(),
      appelsFonds: z.array(
        z.object({
          numero: z.number(),
          label: z.string(),
          datePrevue: z.string().nullable(),
          pourcentage: z.number(),
          montant: z.number(),
        }),
      ),
    }),
  ),
});

function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function parseMonthYear(mois: string, annee: number): Date | null {
  const MONTHS: Record<string, number> = {
    janvier: 1,
    fevrier: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    aout: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    decembre: 12,
  };
  const norm = mois
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, " ")
    .trim();
  for (const [name, num] of Object.entries(MONTHS)) {
    if (norm.includes(name)) {
      return new Date(Date.UTC(annee, num - 1, 1));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ACTION 1 : parse
// ---------------------------------------------------------------------------

export async function parseFondsFileAction(fileB64: string): Promise<
  ActionResult<{
    rows: ParsedFondsLot[];
    appelTypes: ParsedFondsAppelType[];
    errors: string[];
  }>
> {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const parsed = parseFileSchema.safeParse({ fileB64 });
  if (!parsed.success) {
    return { ok: false, error: "Fichier invalide." };
  }

  const buffer = Buffer.from(parsed.data.fileB64, "base64");
  const result = await parseFondsWorkbook(buffer);
  return { ok: true, value: result };
}

// ---------------------------------------------------------------------------
// ACTION 2 : import
// ---------------------------------------------------------------------------

export async function importFondsSuiviAction(input: {
  programmeId: string;
  appelTypes: unknown[];
  rows: unknown[];
}): Promise<ActionResult<{ matched: number; unmatched: string[] }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide." };
  }
  const { programmeId, appelTypes, rows } = parsed.data;

  // Load all lots for this programme once
  const programmeLots = await prisma.lot.findMany({
    where: { programmeId },
    select: { id: true, reference: true, dossierId: true },
  });

  let matched = 0;
  const unmatched: string[] = [];
  const matchedRefs = new Set<string>();

  for (const row of rows) {
    // 1. Direct match by reference
    let lot =
      programmeLots.find((l) => l.reference === row.lotReference) ?? null;

    // 2. Fallback: compare digits only
    if (!lot) {
      const rowDigits = digitsOnly(row.lotReference);
      if (rowDigits) {
        const rowNum = parseInt(rowDigits, 10);
        lot =
          programmeLots.find((l) => {
            const d = digitsOnly(l.reference);
            return d !== "" && parseInt(d, 10) === rowNum;
          }) ?? null;
      }
    }

    if (!lot) {
      unmatched.push(row.lotReference);
      continue;
    }

    // 3. Upsert LotFondsSuivi
    const fondsData = {
      commission:
        row.commission != null ? new Prisma.Decimal(row.commission) : null,
      fraisMainLevee:
        row.fraisMainLevee != null
          ? new Prisma.Decimal(row.fraisMainLevee)
          : null,
      rbstEdd: row.rbstEdd != null ? new Prisma.Decimal(row.rbstEdd) : null,
      soldeVendeur:
        row.soldeVendeur != null ? new Prisma.Decimal(row.soldeVendeur) : null,
      dateEnvoiLr: toDate(row.dateEnvoiLr),
      dateReceptionLr: toDate(row.dateReceptionLr),
      dateReceptionVirement: toDate(row.dateReceptionVirement),
    };
    const fondsSuivi = await prisma.lotFondsSuivi.upsert({
      where: { lotId: lot.id },
      create: { lotId: lot.id, programmeId, ...fondsData },
      update: { programmeId, ...fondsData },
    });

    // 3b. Append notes to Lot.notes
    if (row.notes) {
      const existing = await prisma.lot.findUnique({
        where: { id: lot.id },
        select: { notes: true },
      });
      const newNotes = existing?.notes
        ? `${existing.notes}\n${row.notes}`
        : row.notes;
      await prisma.lot.update({
        where: { id: lot.id },
        data: { notes: newNotes },
      });
    }

    // 4. Replace appels de fonds using appelTypes metadata
    await prisma.appelFonds.deleteMany({
      where: { lotFondsId: fondsSuivi.id },
    });
    const appelFondsData = appelTypes
      .map((at) => {
        const montant = row.appelsFonds.find(
          (a) => a.numero === at.numero,
        )?.montant;
        if (montant == null) return null;
        return {
          lotFondsId: fondsSuivi.id,
          numero: at.numero,
          label: at.label,
          datePrevue: `${at.mois} ${at.annee}`.trim() || null,
          pourcentage: new Prisma.Decimal(at.pourcentage),
          montant: new Prisma.Decimal(montant),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (appelFondsData.length > 0) {
      await prisma.appelFonds.createMany({ data: appelFondsData });
    }

    // 5. ACT_SIGNED timeline event
    const actSignedDate = toDate(row.dateSignatureActe);
    if (actSignedDate && lot.dossierId) {
      const dossier = await prisma.dossier.findUnique({
        where: { id: lot.dossierId },
        select: {
          status: true,
          timelineEvents: {
            where: { kind: "ACT_SIGNED" },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (dossier && dossier.timelineEvents.length === 0) {
        await prisma.timelineEvent.create({
          data: {
            dossierId: lot.dossierId,
            kind: "ACT_SIGNED",
            title: "Acte signé",
            occurredAt: actSignedDate,
          },
        });
        if (dossier.status !== "ACT_SIGNED") {
          await prisma.dossier.update({
            where: { id: lot.dossierId },
            data: { status: "ACT_SIGNED", closedAt: actSignedDate },
          });
        }
      }
    }

    matchedRefs.add(row.lotReference);
    matched++;
  }

  // 6. TresoreriePrev — accumulate monthly income across appelTypes
  const monthMap = new Map<string, { month: Date; income: number }>();
  for (const at of appelTypes) {
    const monthDate = parseMonthYear(at.mois, at.annee);
    if (!monthDate) continue;
    const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const totalIncome = rows.reduce((sum, row) => {
      if (!matchedRefs.has(row.lotReference)) return sum;
      return (
        sum +
        (row.appelsFonds.find((a) => a.numero === at.numero)?.montant ?? 0)
      );
    }, 0);
    if (totalIncome > 0) {
      const existing = monthMap.get(key);
      if (existing) {
        existing.income += totalIncome;
      } else {
        monthMap.set(key, { month: monthDate, income: totalIncome });
      }
    }
  }

  for (const { month, income } of monthMap.values()) {
    await prisma.tresoreriePrev.upsert({
      where: { programmeId_month: { programmeId, month } },
      create: { programmeId, month, income: new Prisma.Decimal(income) },
      update: { income: new Prisma.Decimal(income) },
    });
  }

  const ctx = await getRequestContext();
  await audit({
    userId: me.id,
    action: "FONDS_UPDATED",
    resourceType: "Programme",
    resourceId: programmeId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Import du suivi des fonds : ${matched} lot(s) mis à jour, ${unmatched.length} non reconnu(s)`,
  });

  revalidatePath("/collaborateur/fonds");

  return { ok: true, value: { matched, unmatched } };
}
