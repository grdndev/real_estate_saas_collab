"use client";

import { Fragment, useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SharedNotes, type NoteItem } from "@/components/notes/shared-notes";
import {
  deleteProspectAction,
  updateProspectStatusAction,
} from "@/lib/prospect/actions";
import type { ProspectStatusInput } from "@/lib/prospect/schemas";

export interface ProspectRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string | null;
  phone: string | null;
  programmeName: string | null;
  source: string | null;
  status: ProspectStatusInput;
  createdAt: Date;
  notes: NoteItem[];
}

const STATUS_BADGE: Record<
  ProspectStatusInput,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  NEW: { label: "Nouveau", variant: "neutral" },
  CONTACTED: { label: "Contacté", variant: "info" },
  QUALIFIED: { label: "Qualifié", variant: "warning" },
  OPTIONED: { label: "Optionné", variant: "info" },
  CONVERTED: { label: "Converti", variant: "success" },
  DROPPED: { label: "Abandonné", variant: "danger" },
};

export function ProspectsTable({
  prospects,
  canDelete,
  currentUserId,
}: {
  prospects: ProspectRow[];
  canDelete: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);

  if (prospects.length === 0) {
    return (
      <EmptyState
        title="Aucun prospect"
        description="Importez vos contacts depuis Google Forms ou créez-en un manuellement."
      />
    );
  }

  function onStatusChange(prospectId: string, status: ProspectStatusInput) {
    setError(null);
    startTransition(async () => {
      const r = await updateProspectStatusAction({ prospectId, status });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function onDelete(prospectId: string) {
    if (!confirm("Supprimer ce prospect ?")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteProspectAction(prospectId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Table>
        <THead>
          <Tr>
            <Th>Nom</Th>
            <Th>Email</Th>
            <Th>Commune</Th>
            <Th>Programme</Th>
            <Th>Source</Th>
            <Th>Statut</Th>
            <Th>Créé le</Th>
            <Th>Notes</Th>
            {canDelete && <Th />}
          </Tr>
        </THead>
        <TBody>
          {prospects.map((p) => {
            const sb = STATUS_BADGE[p.status];
            const open = notesOpen === p.id;
            const colSpan = canDelete ? 9 : 8;
            const mainRow = (
              <Tr>
                <Td className="font-medium">
                  {p.firstName} {p.lastName}
                </Td>
                <Td className="text-xs text-slate-600">{p.email}</Td>
                <Td className="text-xs text-slate-600">{p.city ?? "—"}</Td>
                <Td className="text-xs text-slate-600">
                  {p.programmeName ?? "—"}
                </Td>
                <Td className="text-xs text-slate-500">{p.source ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                    <Select
                      value={p.status}
                      onChange={(e) =>
                        onStatusChange(
                          p.id,
                          e.target.value as ProspectStatusInput,
                        )
                      }
                      disabled={pending}
                      className="h-7 text-xs"
                      aria-label="Changer le statut"
                    >
                      {p.status === "NEW" && (
                        <option value="NEW" disabled>
                          Nouveau — à traiter
                        </option>
                      )}
                      {p.status === "OPTIONED" && (
                        <option value="OPTIONED" disabled>
                          Optionné
                        </option>
                      )}
                      {p.status === "CONVERTED" && (
                        <option value="CONVERTED" disabled>
                          Converti
                        </option>
                      )}
                      <option value="CONTACTED">Contacté</option>
                      <option value="QUALIFIED">Qualifié</option>
                      <option value="DROPPED">Abandonné</option>
                    </Select>
                  </div>
                </Td>
                <Td className="text-xs text-slate-500">
                  {p.createdAt.toLocaleDateString("fr-FR")}
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => setNotesOpen(open ? null : p.id)}
                    className="text-equatis-turquoise-700 text-xs hover:underline"
                  >
                    {open ? "Masquer" : `Notes (${p.notes.length})`}
                  </button>
                </Td>
                {canDelete && (
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(p.id)}
                      disabled={pending || p.status === "CONVERTED"}
                    >
                      Supprimer
                    </Button>
                  </Td>
                )}
              </Tr>
            );

            const notesRow = open ? (
              <Tr key={`${p.id}-notes`}>
                <Td colSpan={colSpan} className="bg-slate-50">
                  <SharedNotes
                    scope="PROSPECT"
                    targetId={p.id}
                    notes={p.notes}
                    currentUserId={currentUserId}
                  />
                </Td>
              </Tr>
            ) : null;

            return (
              <Fragment key={p.id}>
                {mainRow}
                {notesRow}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
