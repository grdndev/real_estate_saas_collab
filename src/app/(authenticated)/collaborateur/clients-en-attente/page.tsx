import type { Metadata } from "next";
import Link from "next/link";

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

export const metadata: Metadata = { title: "Clients en attente" };

function expiryBadge(date: Date | null) {
  if (!date) return <span className="text-xs text-slate-400">—</span>;
  const days = Math.round((date.getTime() - Date.now()) / (24 * 3600 * 1000));
  if (days < 0) {
    return <Badge variant="danger">Expirée depuis {-days} j</Badge>;
  }
  if (days <= 14) {
    return <Badge variant="warning">Échéance dans {days} j</Badge>;
  }
  return <Badge variant="info">Échéance dans {days} j</Badge>;
}

export default async function ClientsEnAttentePage() {
  await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const [dossiers, optionedProspects, prospects] = await Promise.all([
    prisma.dossier.findMany({
      where: { optioned: true, archivedAt: null },
      orderBy: { optionExpiresAt: "asc" },
      include: {
        client: { select: { firstName: true, lastName: true } },
        programme: { select: { name: true } },
        lots: { select: { reference: true } },
      },
    }),
    prisma.prospect.findMany({
      where: { status: "OPTIONED" },
      orderBy: { optionExpiresAt: "asc" },
      include: { programme: { select: { name: true } } },
    }),
    prisma.prospect.findMany({
      where: { status: "QUALIFIED" },
      orderBy: { optionExpiresAt: "asc" },
      include: { programme: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Clients en attente
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dossiers optionnés, prospects réservataires et prospects qualifiés —
          capables d&apos;acheter mais avec un délai. Pensez à les relancer
          avant l&apos;échéance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dossiers optionnés ({dossiers.length})</CardTitle>
        </CardHeader>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier optionné"
            description="Les dossiers marqués comme optionnés apparaîtront ici."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Client</Th>
                <Th>Programme</Th>
                <Th>Échéance de l&apos;option</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {dossiers.map((d) => (
                <Tr key={d.id}>
                  <Td>
                    {d.client
                      ? `${d.client.firstName} ${d.client.lastName}`
                      : "—"}
                  </Td>
                  <Td>{d.programme.name}</Td>
                  <Td>{expiryBadge(d.optionExpiresAt)}</Td>
                  <Td>
                    <Link
                      href={`/collaborateur/dossiers/${d.id}`}
                      className="text-equatis-turquoise-700 text-xs hover:underline"
                    >
                      Ouvrir
                    </Link>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Prospects réservataires ({optionedProspects.length})
          </CardTitle>
        </CardHeader>
        {optionedProspects.length === 0 ? (
          <EmptyState
            title="Aucun prospect réservataire"
            description="Dès qu'un prospect passe au statut « Réservataire », il apparaît ici automatiquement."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Prospect</Th>
                <Th>Email</Th>
                <Th>Programme</Th>
                <Th>Échéance de relance</Th>
              </Tr>
            </THead>
            <TBody>
              {optionedProspects.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">
                    {p.firstName} {p.lastName}
                  </Td>
                  <Td className="text-xs text-slate-500">{p.email}</Td>
                  <Td>{p.programme?.name ?? "—"}</Td>
                  <Td>{expiryBadge(p.optionExpiresAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prospects qualifiés ({prospects.length})</CardTitle>
        </CardHeader>
        {prospects.length === 0 ? (
          <EmptyState
            title="Aucun prospect qualifié"
            description="Dès qu'un prospect passe au statut « Qualifié », il apparaît ici automatiquement."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Prospect</Th>
                <Th>Email</Th>
                <Th>Programme</Th>
                <Th>Échéance de relance</Th>
              </Tr>
            </THead>
            <TBody>
              {prospects.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">
                    {p.firstName} {p.lastName}
                  </Td>
                  <Td className="text-xs text-slate-500">{p.email}</Td>
                  <Td>{p.programme?.name ?? "—"}</Td>
                  <Td>{expiryBadge(p.optionExpiresAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        <CardContent className="border-t border-slate-100 text-xs text-slate-500">
          Gérez le statut des prospects depuis la page{" "}
          <Link
            href="/collaborateur/prospects"
            className="text-equatis-turquoise-700 hover:underline"
          >
            Prospects
          </Link>
          .
        </CardContent>
      </Card>
    </div>
  );
}
