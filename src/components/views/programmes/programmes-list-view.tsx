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
import { TrackingImportButtonLazy } from "@/components/collaborateur/tracking-import/tracking-import-button-lazy";
import { PROGRAMME_STATUS_BADGE } from "@/lib/programme/labels";
import type { ProgrammeStatus } from "@/generated/prisma/enums";

/**
 * Vue « liste des programmes » — implémentation unique partagée par l'espace
 * admin et l'espace collaborateur (T12/T15).
 */
export interface ProgrammeListRow {
  id: string;
  name: string;
  city: string | null;
  status: ProgrammeStatus;
  _count: { lots: number; promoters: number };
  /** Lots du programme ayant un client associé (= dossiers actifs). */
  activeDossiers: number;
}

interface Props {
  programmes: ProgrammeListRow[];
  /** Racine « programmes » de l'espace appelant, ex. « /admin/programmes ». */
  basePath: string;
  /** Autorise la création d'un programme et l'import d'un fichier de suivi. */
  canCreate: boolean;
}

export function ProgrammesListView({ programmes, basePath, canCreate }: Props) {
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
        {canCreate && (
          <div className="flex gap-2">
            <TrackingImportButtonLazy
              programmes={programmes.map((p) => ({ id: p.id, name: p.name }))}
            />
            <Link href={`${basePath}/nouveau`}>
              <Button>Nouveau programme</Button>
            </Link>
          </div>
        )}
      </div>

      <Card>
        {programmes.length === 0 ? (
          <EmptyState
            title="Aucun programme"
            description="Créez votre premier programme pour gérer ses lots et lui associer des promoteurs."
            action={
              canCreate ? (
                <Link href={`${basePath}/nouveau`}>
                  <Button>Nouveau programme</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
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
                const badge = PROGRAMME_STATUS_BADGE[p.status];
                return (
                  <Tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="text-slate-600">{p.city ?? "—"}</Td>
                    <Td>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </Td>
                    <Td className="text-right">{p._count.lots}</Td>
                    <Td className="text-right">{p._count.promoters}</Td>
                    <Td className="text-right">{p.activeDossiers}</Td>
                    <Td className="text-right">
                      <Link
                        href={`${basePath}/${p.id}`}
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
