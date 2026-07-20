import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DossierFiltersForm } from "@/components/collab/dossier-filters-form";
import {
  DossiersTable,
  type DossierRow,
} from "@/components/collab/dossiers-table";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dossierWhereForUser } from "@/lib/dossier/access";
import { dossierFiltersSchema } from "@/lib/dossier/schemas";
import { decodePhone } from "@/lib/profile";

export const metadata: Metadata = { title: "Dossiers" };

const PAGE_SIZE = 50;

const STATUS_BADGE = {
  NEW_LEAD: { label: "Nouveau lead", variant: "neutral" as const },
  RESERVATION_SENT: { label: "Réservation envoyée", variant: "info" as const },
  SIGNATURE_PENDING: {
    label: "Signature en attente",
    variant: "warning" as const,
  },
  SIGNED_AT_NOTARY: {
    label: "Envoyé chez le notaire",
    variant: "info" as const,
  },
  LOAN_OFFER_RECEIVED: {
    label: "Offre de prêt reçue",
    variant: "info" as const,
  },
  ACT_SIGNED: { label: "Acte signé", variant: "success" as const },
  BLOCKED: { label: "Bloqué", variant: "danger" as const },
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    programmeId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function DossierListPage({ searchParams }: PageProps) {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const params = await searchParams;
  const filters = dossierFiltersSchema.parse(params);

  const baseWhere = dossierWhereForUser(me.id, me.role);
  const conds: Record<string, unknown>[] = [baseWhere];
  if (filters.status) conds.push({ status: filters.status });
  if (filters.programmeId) conds.push({ programmeId: filters.programmeId });
  if (filters.search) {
    conds.push({
      OR: [
        {
          client: {
            firstName: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          client: {
            lastName: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          programme: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ],
    });
  }
  const where = { AND: conds };
  const skip = (filters.page - 1) * PAGE_SIZE;

  const [total, dossiers, programmes] = await Promise.all([
    prisma.dossier.count({ where }),
    prisma.dossier.findMany({
      where,
      take: PAGE_SIZE,
      skip,
      include: {
        programme: { select: { name: true } },
        lots: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneEnc: true,
          },
        },
        participants: {
          where: { role: "COLLABORATOR_PRIMARY" },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  dossiers.sort((a, b) =>
    (a.lots[0]?.reference ?? "").localeCompare(b.lots[0]?.reference ?? ""),
  );

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR") : null);

  const rows: DossierRow[] = dossiers.map((d) => {
    const sb = STATUS_BADGE[d.status];
    const primary = d.participants[0]?.user;
    const lot = d.lots[0];
    const totalSurface = lot
      ? Number(lot.surface) + Number(lot.annexSurface ?? 0)
      : null;
    return {
      id: d.id,
      clientName: d.client
        ? `${d.client.firstName} ${d.client.lastName}`
        : null,
      clientPhone: d.client ? decodePhone(d.client.phoneEnc) || null : null,
      clientEmail: d.client?.email ?? null,
      programmeName: d.programme.name,
      statusLabel: sb.label,
      statusVariant: sb.variant,
      responsable: primary ? `${primary.firstName} ${primary.lastName}` : null,
      lastActivity: fmt(d.lastActivityAt) ?? "—",

      building: lot?.building ?? null,
      reference: d.lots.map((l) => l.reference).join(", ") || null,
      floor: lot?.floor ?? null,
      type: lot?.type ?? null,
      surface: lot ? Number(lot.surface) : null,
      annexSurface: lot?.annexSurface != null ? Number(lot.annexSurface) : null,
      suv: lot?.suv != null ? Number(lot.suv) : null,
      totalSurface,
      garden: lot?.garden ?? null,
      priceNetVendeur:
        lot?.priceNetVendeur != null ? Number(lot.priceNetVendeur) : null,
      priceNetVendeurWithParking:
        lot?.priceNetVendeurWithParking != null
          ? Number(lot.priceNetVendeurWithParking)
          : null,
      commissionAgence:
        lot?.commissionAgence != null ? Number(lot.commissionAgence) : null,
      commissionAgenceParking:
        lot?.commissionAgenceParking != null
          ? Number(lot.commissionAgenceParking)
          : null,
      priceFAI: lot ? Number(lot.priceTTC) : null,
      priceLocation:
        lot?.priceLocation != null ? Number(lot.priceLocation) : null,
      creditImpot35:
        lot?.creditImpot35 != null ? Number(lot.creditImpot35) : null,
      priceRevientCrdImp:
        lot?.priceRevientCrdImp != null ? Number(lot.priceRevientCrdImp) : null,
      additionalParking: lot?.additionalParking ?? null,

      observation: d.observation,
      financingMode: d.financingMode,
      optionLabel: d.optioned
        ? `Oui${d.optionExpiresAt ? ` (jusqu'au ${fmt(d.optionExpiresAt)})` : ""}`
        : "Non",
      kbisObtainedAt: fmt(d.kbisObtainedAt),
      clientAtRsm: d.clientAtRsm,
      reservationSignedAt: fmt(d.reservationSignedAt),
      notaryTransmittedAt: fmt(d.notaryTransmittedAt),
      deposit200ReceivedAt: fmt(d.deposit200ReceivedAt),
      guaranteeDepositAmount:
        d.guaranteeDepositAmount != null
          ? Number(d.guaranteeDepositAmount)
          : null,
      guaranteeDepositReceivedAt: fmt(d.guaranteeDepositReceivedAt),
      rarSentByNotaryAt: fmt(d.rarSentByNotaryAt),
      loanFiledAt: fmt(d.loanFiledAt),
      loanObtainedAt: fmt(d.loanObtainedAt),
      reservationEndDate: fmt(d.reservationEndDate),
      actSignedAt: fmt(d.actSignedAt),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Dossiers
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} dossier{total > 1 ? "s" : ""} —{" "}
            <span className="text-slate-500">
              page {filters.page} / {totalPages}
            </span>
          </p>
        </div>
        <Link href="/collaborateur/dossiers/nouveau">
          <Button>Nouveau dossier</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <DossierFiltersForm programmes={programmes} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DossiersTable rows={rows} />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-end gap-2"
        >
          {filters.page > 1 && (
            <Link
              href={`?${new URLSearchParams({
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.programmeId
                  ? { programmeId: filters.programmeId }
                  : {}),
                ...(filters.search ? { search: filters.search } : {}),
                page: String(filters.page - 1),
              }).toString()}`}
              className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ← Précédent
            </Link>
          )}
          <span className="text-sm text-slate-600">
            {filters.page} / {totalPages}
          </span>
          {filters.page < totalPages && (
            <Link
              href={`?${new URLSearchParams({
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.programmeId
                  ? { programmeId: filters.programmeId }
                  : {}),
                ...(filters.search ? { search: filters.search } : {}),
                page: String(filters.page + 1),
              }).toString()}`}
              className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
