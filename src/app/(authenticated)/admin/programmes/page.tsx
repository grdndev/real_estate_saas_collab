import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Programmes · Admin" };

const STATUS_BADGE = {
  DRAFT: { label: "Brouillon", variant: "neutral" as const },
  ACTIVE: { label: "Actif", variant: "success" as const },
  ARCHIVED: { label: "Archivé", variant: "warning" as const },
};

export default async function AdminProgrammesPage() {
  const programmes = await prisma.programme.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { lots: true, dossiers: true, promoters: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Programmes
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {programmes.length} programme
            {programmes.length > 1 ? "s" : ""} enregistré
            {programmes.length > 1 ? "s" : ""}.
          </p>
        </div>
        <Link href="/admin/programmes/nouveau">
          <Button>Nouveau programme</Button>
        </Link>
      </div>

      <Card>
        {programmes.length === 0 ? (
          <EmptyState
            title="Aucun programme"
            description="Créez votre premier programme pour gérer ses lots et lui associer des promoteurs."
            action={
              <Link href="/admin/programmes/nouveau">
                <Button>Nouveau programme</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Référence</Th>
                <Th>Nom</Th>
                <Th>Ville</Th>
                <Th>Statut</Th>
                <Th className="text-right">Lots</Th>
                <Th className="text-right">Promoteurs</Th>
                <Th className="text-right">Dossiers</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {programmes.map((p) => {
                const badge = STATUS_BADGE[p.status];
                return (
                  <Tr key={p.id}>
                    <Td className="font-mono text-xs">{p.reference}</Td>
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="text-slate-600">{p.city ?? "—"}</Td>
                    <Td>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </Td>
                    <Td className="text-right">{p._count.lots}</Td>
                    <Td className="text-right">{p._count.promoters}</Td>
                    <Td className="text-right">{p._count.dossiers}</Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/programmes/${p.id}`}
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
    </div>
  );
}
