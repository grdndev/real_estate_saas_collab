import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";
import {
  CONTRACT_STATUS_BADGE,
  CONTRACT_STATUS_LABEL,
} from "@/lib/dossier/labels";

export const metadata: Metadata = { title: "Suivi des contrats" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeContractsPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const dossiers = await prisma.dossier.findMany({
    where: { programmeId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      lot: { select: { reference: true, type: true } },
      client: { select: { firstName: true, lastName: true } },
      signatures: { select: { status: true, signedAt: true } },
      appointments: {
        where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
    },
  });

  const withContract = dossiers.filter((d) => d.contractStatus != null);
  const signedCount = dossiers.filter((d) =>
    d.signatures.some((s) => s.status === "SIGNED"),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Suivi des contrats
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {programme.name} — contrats signés par client et dossiers associés.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {dossiers.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contrats signés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {signedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>En cours contractuel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {withContract.length}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Contrats par client</CardTitle>
        </CardHeader>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier"
            description="Aucun dossier n'a encore été créé sur ce programme."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Client</Th>
                <Th>Lot</Th>
                <Th>Statut contractuel</Th>
                <Th>Signature</Th>
                <Th>Prochain RDV notaire</Th>
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => {
                const signed = d.signatures.find((s) => s.status === "SIGNED");
                const appt = d.appointments[0];
                return (
                  <Tr key={d.id}>
                    <Td className="font-medium">
                      {d.client
                        ? `${d.client.firstName} ${d.client.lastName}`
                        : "— Client non associé"}
                    </Td>
                    <Td>
                      {d.lot ? `${d.lot.reference} · ${d.lot.type}` : "—"}
                    </Td>
                    <Td>
                      {d.contractStatus ? (
                        <Badge
                          variant={CONTRACT_STATUS_BADGE[d.contractStatus]}
                        >
                          {CONTRACT_STATUS_LABEL[d.contractStatus]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Pas encore en phase contrat
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {signed?.signedAt ? (
                        <span className="text-emerald-700">
                          Signé le {signed.signedAt.toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="text-slate-400">Non signé</span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {appt ? (
                        appt.scheduledAt.toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
