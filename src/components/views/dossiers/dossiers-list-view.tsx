import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DossierFiltersForm } from "@/components/collab/dossier-filters-form";
import { DossiersTable } from "@/components/collab/dossiers-table";
import type { DossierListResult } from "@/lib/dossier/list-access";
import type { DossierFiltersInput } from "@/lib/dossier/schemas";

/**
 * Vue « liste des dossiers » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin (T5/T15). Les données arrivent déjà filtrées
 * par la route (`loadDossierList`).
 */
interface Props {
  data: DossierListResult;
  filters: DossierFiltersInput;
  /** Racine « dossiers » de l'espace appelant, ex. « /admin/dossiers ». */
  basePath: string;
}

function buildHref(
  filters: DossierFiltersInput,
  overrides: { page?: number; archives?: boolean } = {},
): string {
  const archives = overrides.archives ?? filters.archives;
  return `?${new URLSearchParams({
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(archives ? { archives: "1" } : {}),
    page: String(overrides.page ?? filters.page),
  }).toString()}`;
}

export function DossiersListView({ data, filters, basePath }: Props) {
  const { total, totalPages, rows, programmes } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Dossiers
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} dossier{total > 1 ? "s" : ""} —{" "}
            <span className="text-slate-500">
              page {filters.page} / {totalPages}
            </span>
            {filters.archives && (
              <span className="text-slate-500">
                {" "}
                · historique inclus (dossiers archivés)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Accès explicite à l'historique des clients dissociés (T10). */}
          <Link
            href={buildHref(filters, { page: 1, archives: !filters.archives })}
            className="text-equatis-turquoise-700 rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {filters.archives
              ? "Masquer les dossiers archivés"
              : "Afficher les dossiers archivés"}
          </Link>
          <Link href={`${basePath}/nouveau`}>
            <Button>Nouveau dossier</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <DossierFiltersForm programmes={programmes} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DossiersTable rows={rows} basePath={basePath} />
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
