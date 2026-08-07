"use client";

import { Fragment, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
import { Button } from "@/components/ui/button";
import { SharedNotes, type NoteItem } from "@/components/notes/shared-notes";
import {
  ConvertProspectDialog,
  type ProgrammeLotOption,
} from "@/components/prospects/convert-prospect-dialog";
import {
  deleteProspectAction,
  revertProspectConversionAction,
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
  programmeId: string | null;
  programmeName: string | null;
  source: string | null;
  status: ProspectStatusInput;
  convertedDossierId: string | null;
  /** Lot du dossier converti — cible du lien « Voir le lot ». */
  convertedLotId: string | null;
  dossierHasActivity: boolean;
  createdAt: Date;
  notes: NoteItem[];
}

// Chaîne ordonnée du cycle de vie (hors CONVERTED/DROPPED).
const CHAIN = ["NEW", "QUALIFIED", "OPTIONED"] as const;

const STATUS_BADGE: Record<
  ProspectStatusInput,
  {
    label: string;
    variant: "neutral" | "info" | "warning" | "success" | "danger";
  }
> = {
  NEW: { label: "Prospect", variant: "neutral" },
  QUALIFIED: { label: "Prospect qualifié", variant: "warning" },
  OPTIONED: { label: "Prospect réservataire", variant: "info" },
  CONVERTED: { label: "Client", variant: "success" },
  DROPPED: { label: "Abandonné", variant: "danger" },
};

export function ProspectsTable({
  prospects,
  programmes,
  canDelete,
  currentUserId,
  lotBasePath,
}: {
  prospects: ProspectRow[];
  programmes: ProgrammeLotOption[];
  canDelete: boolean;
  currentUserId: string;
  /** Racine « lots » de l'espace appelant ; `null` si l'espace n'y donne pas accès. */
  lotBasePath: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [convertFor, setConvertFor] = useState<ProspectRow | null>(null);

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

  function onRevert(prospectId: string) {
    if (!confirm("Annuler la conversion et supprimer le dossier vide ?"))
      return;
    setError(null);
    startTransition(async () => {
      const r = await revertProspectConversionAction({ prospectId });
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
            const chainIdx = (CHAIN as readonly string[]).indexOf(p.status);
            const inChain = chainIdx !== -1;
            const canAdvance = inChain && chainIdx < CHAIN.length - 1;
            const canRecede = inChain && chainIdx > 0;

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
                  <div className="flex flex-col gap-1.5">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {inChain && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={pending || !canRecede}
                            onClick={() =>
                              canRecede &&
                              onStatusChange(
                                p.id,
                                CHAIN[chainIdx - 1] as ProspectStatusInput,
                              )
                            }
                            aria-label="Reculer d'un stade"
                          >
                            ◀
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={pending || !canAdvance}
                            onClick={() =>
                              canAdvance &&
                              onStatusChange(
                                p.id,
                                CHAIN[chainIdx + 1] as ProspectStatusInput,
                              )
                            }
                            aria-label="Avancer d'un stade"
                          >
                            ▶
                          </Button>
                          {p.status === "OPTIONED" && (
                            <Button
                              size="sm"
                              variant="accent"
                              className="h-7 px-2 text-xs"
                              disabled={pending}
                              onClick={() => setConvertFor(p)}
                            >
                              Convertir en client
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() => onStatusChange(p.id, "DROPPED")}
                          >
                            Abandonner
                          </Button>
                        </>
                      )}

                      {p.status === "DROPPED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={pending}
                          onClick={() => onStatusChange(p.id, "NEW")}
                        >
                          Réactiver
                        </Button>
                      )}

                      {p.status === "CONVERTED" && (
                        <>
                          {p.convertedLotId && lotBasePath && (
                            <Link
                              href={`${lotBasePath}/${p.convertedLotId}`}
                              className="text-equatis-turquoise-700 text-xs hover:underline"
                            >
                              Voir le lot
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={pending || p.dossierHasActivity}
                            title={
                              p.dossierHasActivity
                                ? "Le dossier a de l'activité : annulation impossible."
                                : undefined
                            }
                            onClick={() => onRevert(p.id)}
                          >
                            Annuler la conversion
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Td>
                <Td className="text-xs text-slate-500">
                  <time
                    dateTime={p.createdAt.toISOString()}
                    suppressHydrationWarning
                  >
                    {p.createdAt.toLocaleDateString("fr-FR")}
                  </time>
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

      {convertFor && (
        <ConvertProspectDialog
          open
          prospect={convertFor}
          programmes={programmes}
          defaultProgrammeId={convertFor.programmeId}
          onClose={() => setConvertFor(null)}
        />
      )}
    </div>
  );
}
