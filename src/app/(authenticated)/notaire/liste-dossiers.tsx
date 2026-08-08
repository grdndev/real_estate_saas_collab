"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { useChunkedRows } from "@/components/ui/chunked-rows";
import { InfiniteSentinel } from "@/components/ui/infinite-rows";

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

export default function ListeDossiers({
  dossiers,
}: {
  dossiers: Array<{
    id: string;
    status: keyof typeof STATUS_BADGE;
    notaryTransmittedAt: Date | null;
    lot: { reference: string; programme: { name: string } };
    client: { firstName: string; lastName: string };
  }>;
}) {
  // Les dossiers d'un notaire sont tous chargés par la route : seul le rendu
  // est découpé, pour éviter de construire la table entière d'un coup.
  const { rows, loading, done, error, setSentinel, retry } = useChunkedRows({
    allRows: dossiers,
  });

  return (
    <>
      {/* Pas de scroll vertical interne : la sentinelle est rendue sous le
          tableau et doit rester pilotée par le scroll de la page. */}
      <Table scrollY={false}>
        <THead>
          <Tr>
            <Th>Client</Th>
            <Th>Programme</Th>
            <Th>Lot</Th>
            <Th>Statut</Th>
            <Th>Reçu le</Th>
            <Th />
          </Tr>
        </THead>
        <TBody>
          {rows.map((d) => {
            const sb = STATUS_BADGE[d.status];
            return (
              <Tr key={d.id}>
                <Td>
                  {d.client.firstName} {d.client.lastName}
                </Td>
                <Td>{d.lot.programme.name}</Td>
                <Td>{d.lot.reference}</Td>
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
      <InfiniteSentinel
        loading={loading}
        done={done}
        error={error}
        setSentinel={setSentinel}
        retry={retry}
        loadedCount={rows.length}
        itemLabel="dossier"
      />
    </>
  );
}
