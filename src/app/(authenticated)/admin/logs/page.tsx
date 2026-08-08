import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  getActivityEntities,
  getDossierContext,
  getProgrammeContext,
  getUserContext,
  loadActivityPage,
} from "@/lib/admin/activity";
import {
  activityFiltersFrom,
  parseActivityQuery,
} from "@/lib/admin/activity-params";
import { requireRole } from "@/lib/auth/guards";
import { ActivityFilters } from "./activity-filters";
import { ActivityTable } from "./activity-table";
import { DossierContextPanel } from "./dossier-context";
import { ProgrammeContextPanel } from "./programme-context";
import { UserContextPanel } from "./user-context";

export const metadata: Metadata = { title: "Activité · Admin" };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

const SCOPE_HINT = {
  utilisateur: "Actions réalisées par cet utilisateur.",
  programme:
    "Actions sur le programme et ses entités liées : lots, documents, prospects, suivi des fonds, dossiers (au niveau dossier).",
  dossier:
    "Actions sur le dossier et ses entités liées : documents, demandes de pièces, messages, signatures, rendez-vous, factures, notes, lots.",
} as const;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("SUPER_ADMIN");
  const params = await searchParams;

  const query = parseActivityQuery((key) => single(params[key]));
  const { vue, id } = query;
  const filters = activityFiltersFrom(query);

  // Le panneau contextuel et la première tranche se résolvent en parallèle :
  // `loadActivityPage` se replie déjà seul sur toute l'activité quand l'entité
  // visée n'existe pas, le panneau vaut alors `null`.
  const [entities, data, context] = await Promise.all([
    getActivityEntities(),
    loadActivityPage(vue, id, filters),
    resolveContext(vue, id),
  ]);

  const scopeHint =
    vue !== "tout" && id
      ? context === null
        ? "Entité introuvable — affichage de toute l'activité."
        : SCOPE_HINT[vue]
      : null;

  // Clé de remontée : un changement de périmètre ou de filtre doit repartir
  // d'une liste vide plutôt que d'empiler des tranches d'un autre périmètre.
  const scopeKey = JSON.stringify(query);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Journal d&apos;activité
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Suivez l&apos;activité par utilisateur, par programme ou par dossier —
          la liste se complète au fil du défilement.
        </p>
      </div>

      <Card className="px-5 py-4">
        <ActivityFilters
          values={query}
          users={entities.users}
          programmes={entities.programmes}
          dossiers={entities.dossiers}
        />
      </Card>

      {context}

      <Card>
        {scopeHint && (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            {scopeHint}
          </p>
        )}
        <ActivityTable
          key={scopeKey}
          initialLogs={data.logs}
          initialCursor={data.nextCursor}
          total={data.total}
        />
      </Card>
    </div>
  );
}

/** Panneau contextuel de l'entité visée, `null` si elle n'existe pas. */
async function resolveContext(
  vue: ReturnType<typeof parseActivityQuery>["vue"],
  id: string,
): Promise<React.ReactNode> {
  if (!id) return null;
  if (vue === "utilisateur") {
    const user = await getUserContext(id);
    return user ? <UserContextPanel user={user} /> : null;
  }
  if (vue === "programme") {
    const programme = await getProgrammeContext(id);
    return programme ? <ProgrammeContextPanel programme={programme} /> : null;
  }
  if (vue === "dossier") {
    const dossier = await getDossierContext(id);
    return dossier ? <DossierContextPanel dossier={dossier} /> : null;
  }
  return null;
}
