import Link from "next/link";
import { Banknote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { ArchiveProgrammeButton } from "@/components/admin/archive-programme";
import { CreateLotForm } from "@/components/admin/lot-form";
import { DeleteLotButton } from "@/components/admin/lot-row-actions";
import { UnassignClientButton } from "@/components/collab/unassign-client";
import { PromoterAssignment } from "@/components/admin/promoter-assignment";
import { OpenDossierCell } from "@/components/views/programmes/open-dossier-cell";
import { LotReferenceHeader } from "@/components/views/lots/lot-reference-header";
import { LOT_STATUS_BADGE } from "@/lib/lot/labels";
import { sortByLotReference, type LotSortDirection } from "@/lib/lot/sort";
import { PROGRAMME_STATUS_BADGE } from "@/lib/programme/labels";
import type { Prisma } from "@/generated/prisma/client";
import type { ProgrammeDetail } from "@/lib/programme/access";

/**
 * Vue « détail d'un programme » — implémentation unique partagée par l'espace
 * admin et l'espace collaborateur (T12/T15).
 */
interface Props {
  programme: ProgrammeDetail;
  availablePromoters: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
  /** Racine « programmes » de l'espace appelant, ex. « /admin/programmes ». */
  basePath: string;
  /** Racine « dossiers » de l'espace appelant, ex. « /admin/dossiers ». */
  dossierBasePath: string;
  /** Racine « suivi des fonds » de l'espace appelant. */
  fondsBasePath: string;
  /** Modification / archivage du programme et CRUD des lots. */
  canEdit: boolean;
  /** Assignation des promoteurs — réservée au SUPER_ADMIN. */
  canManagePromoters: boolean;
  /** Sens du tri naturel sur la référence de lot (T13). */
  sortDirection: LotSortDirection;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Surface facultative, en m² (T6). */
function surfaceLabel(value: Prisma.Decimal | null): string {
  return value == null ? "—" : `${value.toString()} m²`;
}

export function ProgrammeDetailView({
  programme,
  availablePromoters,
  basePath,
  dossierBasePath,
  fondsBasePath,
  canEdit,
  canManagePromoters,
  sortDirection,
}: Props) {
  const badge = PROGRAMME_STATUS_BADGE[programme.status];
  // Tri naturel : « Lot 2 » précède « Lot 10 » (T13).
  const lots = sortByLotReference(
    programme.lots,
    (l) => l.reference,
    sortDirection,
  );
  const isArchived = programme.status === "ARCHIVED";
  const assignedPromoters = programme.promoters.map((pp) => pp.promoter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={basePath}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour à la liste
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
              {programme.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {programme.city && <span>{programme.city}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`${fondsBasePath}?programme=${programme.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Banknote className="size-4" aria-hidden />
              Suivi des fonds
            </Link>
            {canEdit && !isArchived && (
              <>
                <Link
                  href={`${basePath}/${programme.id}/modifier`}
                  className="text-equatis-night-800 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Modifier
                </Link>
                <ArchiveProgrammeButton
                  programmeId={programme.id}
                  basePath={basePath}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {programme.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line text-slate-700">
              {programme.description}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Promoteurs assignés</CardTitle>
        </CardHeader>
        <CardContent>
          {canManagePromoters ? (
            <PromoterAssignment
              programmeId={programme.id}
              assigned={assignedPromoters}
              available={availablePromoters}
              archived={isArchived}
            />
          ) : assignedPromoters.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun promoteur assigné.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {assignedPromoters.map((p) => (
                <li key={p.id}>
                  {p.firstName} {p.lastName}{" "}
                  <span className="text-slate-500">({p.email})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lots ({programme.lots.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {programme.lots.length === 0 ? (
            <EmptyState
              title="Aucun lot"
              description="Ajoutez le premier lot du programme via le formulaire ci-dessous."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <LotReferenceHeader direction={sortDirection} label="Réf." />
                  <Th>Surface habitable</Th>
                  <Th>Surface annexe</Th>
                  <Th>Surface utile SUV</Th>
                  <Th>Étage</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Prix HT</Th>
                  <Th className="text-right">TVA</Th>
                  <Th className="text-right">Prix TTC</Th>
                  <Th>Statut</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {lots.map((lot) => {
                  const lb = LOT_STATUS_BADGE[lot.status];
                  return (
                    <Tr key={lot.id}>
                      <Td className="font-mono">{lot.reference}</Td>
                      <Td>{lot.surface.toString()} m²</Td>
                      <Td>{surfaceLabel(lot.annexSurface)}</Td>
                      <Td>{surfaceLabel(lot.suv)}</Td>
                      <Td>{lot.floor ?? "—"}</Td>
                      <Td>{lot.type}</Td>
                      <Td className="text-right">
                        {eur.format(Number(lot.priceHT))}
                      </Td>
                      <Td className="text-right">{lot.vatRate.toString()} %</Td>
                      <Td className="text-right font-medium">
                        {eur.format(Number(lot.priceTTC))}
                      </Td>
                      <Td>
                        <Badge variant={lb.variant}>{lb.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Le lot est toujours ouvrable : dossier existant ou création (T5). */}
                          <OpenDossierCell
                            lotId={lot.id}
                            lotReference={lot.reference}
                            dossierId={lot.dossier?.id ?? null}
                            dossierBasePath={dossierBasePath}
                          />
                          {canEdit && !isArchived && (
                            <>
                              {lot.dossier?.clientId && lot.dossier.client && (
                                <UnassignClientButton
                                  dossierId={lot.dossier.id}
                                  clientName={`${lot.dossier.client.firstName} ${lot.dossier.client.lastName}`}
                                  convertedProspect={Boolean(
                                    lot.dossier.prospect,
                                  )}
                                  pendingSignature={
                                    lot.dossier.signatures.length > 0
                                  }
                                  variant="ghost"
                                />
                              )}
                              <DeleteLotButton lotId={lot.id} />
                            </>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}

          {canEdit && !isArchived && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-equatis-night-800 mb-3 text-sm font-medium">
                Ajouter un lot
              </p>
              <CreateLotForm programmeId={programme.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
