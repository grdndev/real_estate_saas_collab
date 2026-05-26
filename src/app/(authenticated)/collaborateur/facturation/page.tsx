import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceManager } from "@/components/facturation/invoice-manager";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Facturation" };

export default async function FacturationPage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  // Tout dossier rattaché à un client est facturable.
  const dossiers = await prisma.dossier.findMany({
    where: { clientId: { not: null } },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { firstName: true, lastName: true } },
      programme: { select: { name: true } },
      invoices: { orderBy: { createdAt: "desc" } },
      appointments: {
        where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
    },
  });

  const pendingCount = dossiers.reduce(
    (acc, d) => acc + d.invoices.filter((i) => i.status === "DRAFT").length,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Facturation
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dépôt des factures d&apos;honoraires et transmission au notaire.
          Chaque dossier rattaché à un client est facturable ici.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} ·{" "}
            {pendingCount} facture{pendingCount > 1 ? "s" : ""} en brouillon
          </CardTitle>
        </CardHeader>
      </Card>

      {dossiers.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-slate-500">
              Aucun dossier à facturer pour l&apos;instant. Les dossiers avec un
              rendez-vous notaire apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        dossiers.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  <Link
                    href={`/collaborateur/dossiers/${d.id}`}
                    className="hover:underline"
                  >
                    {d.client
                      ? `${d.client.firstName} ${d.client.lastName}`
                      : "Client non associé"}
                  </Link>
                  <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                    {d.reference}
                  </span>
                </CardTitle>
                {d.appointments[0] && (
                  <Badge variant="info">
                    RDV notaire :{" "}
                    {d.appointments[0].scheduledAt.toLocaleDateString("fr-FR")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">{d.programme.name}</p>
            </CardHeader>
            <CardContent>
              <InvoiceManager
                dossierId={d.id}
                hasNotary={Boolean(d.notaryId)}
                invoices={d.invoices.map((i) => ({
                  id: i.id,
                  number: i.number,
                  amountHT: Number(i.amountHT),
                  amountTTC: Number(i.amountTTC),
                  status: i.status,
                  hasFile: Boolean(i.storageKey),
                  sentToNotaryAt: i.sentToNotaryAt
                    ? i.sentToNotaryAt.toISOString()
                    : null,
                }))}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
