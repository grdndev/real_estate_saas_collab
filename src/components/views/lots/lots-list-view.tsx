import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LotFiltersForm } from "@/components/lots/lot-filters-form";
import { LotsTable } from "@/components/lots/lots-table";
import type { LotListResult } from "@/lib/lot/list-access";
import type { LotFiltersInput } from "@/lib/lot/schemas";

/**
 * Vue « liste des lots » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin (T5/T15). Les données arrivent déjà filtrées
 * par la route (`loadLotList`).
 *
 * Un lot est toujours listé, qu'il porte un client ou non.
 */
interface Props {
  data: LotListResult;
  filters: LotFiltersInput;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

function buildHref(
  filters: LotFiltersInput,
  overrides: { page?: number; associes?: boolean } = {},
): string {
  const associes = overrides.associes ?? filters.associes;
  return `?${new URLSearchParams({
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.lotStatus ? { lotStatus: filters.lotStatus } : {}),
    ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(associes ? { associes: "1" } : {}),
    page: String(overrides.page ?? filters.page),
  }).toString()}`;
}

export function LotsListView({ data, filters, basePath }: Props) {
  const { total, totalPages, rows, programmes } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Lots
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} lot{total > 1 ? "s" : ""} —{" "}
            <span className="text-slate-500">
              page {filters.page} / {totalPages}
            </span>
            {filters.associes && (
              <span className="text-slate-500"> · avec client associé</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={buildHref(filters, { page: 1, associes: !filters.associes })}
            className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {filters.associes
              ? "Afficher aussi les lots libres"
              : "Uniquement les lots associés"}
          </Link>
          <Link href={`${basePath}/nouveau`}>
            <Button>Nouveau lot</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <LotFiltersForm programmes={programmes} basePath={basePath} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <LotsTable rows={rows} basePath={basePath} />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-end gap-2"
        >
          {filters.page > 1 && (
            <Link
              href={buildHref(filters, { page: filters.page - 1 })}
              className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ← Précédent
            </Link>
          )}
          <span className="text-sm text-slate-600">
            {filters.page} / {totalPages}
          </span>
          {filters.page < totalPages && (
            <Link
              href={buildHref(filters, { page: filters.page + 1 })}
              className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Suivant →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
