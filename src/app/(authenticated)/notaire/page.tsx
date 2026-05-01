import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dossierWhereForUser } from "@/lib/dossier/access";

export const metadata: Metadata = { title: "Dossiers reçus" };

const STATUS_BADGE = {
  NEW_LEAD: { label: "Reçu", variant: "info" as const },
  RESERVATION_SENT: { label: "Reçu", variant: "info" as const },
  SIGNATURE_PENDING: { label: "En cours", variant: "warning" as const },
  SIGNED_AT_NOTARY: {
    label: "En cours de préparation",
    variant: "info" as const,
  },
  LOAN_OFFER_RECEIVED: {
    label: "Acte prêt à signer",
    variant: "warning" as const,
  },
  ACT_SIGNED: { label: "Acte signé", variant: "success" as const },
  BLOCKED: { label: "Bloqué", variant: "danger" as const },
};

export default async function NotaireDashboardPage() {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  const where = dossierWhereForUser(me.id, me.role);

  const dossiers = await prisma.dossier.findMany({
    where,
    orderBy: { notaryTransmittedAt: "desc" },
    include: {
      programme: { select: { name: true, reference: true } },
      lot: { select: { reference: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Dossiers reçus
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} transmis par
          les collaborateurs Équatis.
        </p>
      </div>

      <Card>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier reçu"
            description="Les dossiers transmis par les collaborateurs Équatis apparaîtront ici."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Référence</Th>
                <Th>Programme</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th>Reçu le</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => {
                const sb = STATUS_BADGE[d.status];
                return (
                  <Tr key={d.id}>
                    <Td className="font-mono text-xs">{d.reference}</Td>
                    <Td>{d.programme.name}</Td>
                    <Td>{d.lot?.reference ?? "—"}</Td>
                    <Td>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {d.notaryTransmittedAt
                        ? d.notaryTransmittedAt.toLocaleDateString("fr-FR")
                        : "—"}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/notaire/${d.id}`}
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
