"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";

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
    programme: { name: string };
    lots: { reference: string }[];
    client: { firstName: string; lastName: string } | null;
  }>;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(dossiers.length / pageSize);
  const paginatedDossiers = dossiers.slice(
    page * pageSize,
    (page + 1) * pageSize,
  );

  return (
    <>
      <Table>
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
          {paginatedDossiers.map((d) => {
            const sb = STATUS_BADGE[d.status];
            return (
              <Tr key={d.id}>
                <Td>
                  {d.client
                    ? `${d.client.firstName} ${d.client.lastName}`
                    : "—"}
                </Td>
                <Td>{d.programme.name}</Td>
                <Td>{d.lots.map((l) => l.reference).join(", ") || "—"}</Td>
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
      <div className="flex items-center justify-end space-x-2 p-2">
        <span className="text-sm text-slate-500">
          Page {page + 1} sur {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          disabled={page === 0}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
        >
          Précédent
        </button>
        <button
          onClick={() =>
            setPage((p) => (paginatedDossiers.length === pageSize ? p + 1 : p))
          }
          disabled={paginatedDossiers.length < pageSize}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
        >
          Suivant
        </button>
      </div>
    </>
  );
}
