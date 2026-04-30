import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { DossierFiltersForm } from "@/components/collab/dossier-filters-form";
import { RevealNameButton } from "@/components/collab/reveal-name-button";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dossierWhereForUser } from "@/lib/dossier/access";
import { dossierFiltersSchema } from "@/lib/dossier/schemas";

export const metadata: Metadata = { title: "Dossiers" };

const PAGE_SIZE = 50;

const STATUS_BADGE = {
  NEW_LEAD: { label: "Nouveau lead", variant: "neutral" as const },
  RESERVATION_SENT: { label: "Réservation envoyée", variant: "info" as const },
  SIGNATURE_PENDING: {
    label: "Signature en attente",
    variant: "warning" as const,
  },
  SIGNED_AT_NOTARY: { label: "Chez le notaire", variant: "info" as const },
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
        { reference: { contains: filters.search, mode: "insensitive" } },
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
      orderBy: { lastActivityAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        programme: { select: { name: true, reference: true } },
        lot: { select: { reference: true } },
        client: { select: { firstName: true, lastName: true } },
        participants: {
          where: { role: "COLLABORATOR_PRIMARY" },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.programme.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, reference: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier ne correspond"
            description="Modifiez vos filtres ou créez un nouveau dossier."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Référence</Th>
                <Th>Client</Th>
                <Th>Programme</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th>Responsable</Th>
                <Th>Dernière action</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => {
                const sb = STATUS_BADGE[d.status];
                const primary = d.participants[0]?.user;
                return (
                  <Tr key={d.id}>
                    <Td className="font-mono text-xs">{d.reference}</Td>
                    <Td>
                      {d.client ? (
                        <RevealNameButton
                          dossierId={d.id}
                          fallbackMasked={`●●●●● ●●●●●●`}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>{d.programme.name}</Td>
                    <Td>{d.lot?.reference ?? "—"}</Td>
                    <Td>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-600">
                      {primary
                        ? `${primary.firstName} ${primary.lastName}`
                        : "—"}
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {d.lastActivityAt.toLocaleDateString("fr-FR")}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/collaborateur/dossiers/${d.id}`}
                        className="text-equatis-turquoise-700 text-sm hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
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
