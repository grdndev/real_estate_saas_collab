import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  ACTIVITY_PAGE_SIZE,
  getDossierActivity,
  getDossierContext,
  getProgrammeActivity,
  getProgrammeContext,
  getRecentActivity,
  getUserActivity,
  getUserContext,
  getActivityEntities,
  type ActivityFilters as Filters,
  type ActivityPage,
} from "@/lib/admin/activity";
import { requireRole } from "@/lib/auth/guards";
import { ActivityFilters, type ActivityVue } from "./activity-filters";
import { ActivityTable } from "./activity-table";
import { DossierContextPanel } from "./dossier-context";
import { ProgrammeContextPanel } from "./programme-context";
import { UserContextPanel } from "./user-context";

export const metadata: Metadata = { title: "Activité · Admin" };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function parseDate(value: string, endOfDay: boolean): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("SUPER_ADMIN");
  const params = await searchParams;

  const vueParam = single(params.vue);
  const vue: ActivityVue = ["utilisateur", "programme", "dossier"].includes(
    vueParam,
  )
    ? (vueParam as ActivityVue)
    : "tout";
  const id = single(params.id);
  const action = single(params.action);
  const du = single(params.du);
  const au = single(params.au);
  const pageParam = Number.parseInt(single(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam > 1 ? pageParam - 1 : 0;

  const filters: Filters = {
    action: action || undefined,
    from: du ? parseDate(du, false) : undefined,
    to: au ? parseDate(au, true) : undefined,
    page,
  };

  const entities = await getActivityEntities();

  let data: ActivityPage | null = null;
  let contextPanel: React.ReactNode = null;
  let scopeHint: string | null = null;

  if (vue === "utilisateur" && id) {
    const [activity, user] = await Promise.all([
      getUserActivity(id, filters),
      getUserContext(id),
    ]);
    if (user) {
      data = activity;
      contextPanel = <UserContextPanel user={user} />;
      scopeHint = "Actions réalisées par cet utilisateur.";
    }
  } else if (vue === "programme" && id) {
    const [activity, programme] = await Promise.all([
      getProgrammeActivity(id, filters),
      getProgrammeContext(id),
    ]);
    if (programme) {
      data = activity;
      contextPanel = <ProgrammeContextPanel programme={programme} />;
      scopeHint =
        "Actions sur le programme et ses entités liées : lots, documents, prospects, suivi des fonds, dossiers (au niveau dossier).";
    }
  } else if (vue === "dossier" && id) {
    const [activity, dossier] = await Promise.all([
      getDossierActivity(id, filters),
      getDossierContext(id),
    ]);
    if (dossier) {
      data = activity;
      contextPanel = <DossierContextPanel dossier={dossier} />;
      scopeHint =
        "Actions sur le dossier et ses entités liées : documents, demandes de pièces, messages, signatures, rendez-vous, factures, notes, lots.";
    }
  }
  if (!data) {
    data = await getRecentActivity(filters);
    scopeHint =
      vue !== "tout" && id
        ? "Entité introuvable — affichage de toute l'activité."
        : null;
  }

  const baseParams: Record<string, string> = {};
  if (vue !== "tout") baseParams.vue = vue;
  if (vue !== "tout" && id) baseParams.id = id;
  if (action) baseParams.action = action;
  if (du) baseParams.du = du;
  if (au) baseParams.au = au;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Journal d&apos;activité
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Suivez l&apos;activité par utilisateur, par programme ou par dossier —{" "}
          {ACTIVITY_PAGE_SIZE} entrées par page.
        </p>
      </div>

      <Card className="px-5 py-4">
        <ActivityFilters
          values={{ vue, id, action, du, au }}
          users={entities.users}
          programmes={entities.programmes}
          dossiers={entities.dossiers}
        />
      </Card>

      {contextPanel}

      <Card>
        {scopeHint && (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            {scopeHint}
          </p>
        )}
        <ActivityTable data={data} baseParams={baseParams} />
      </Card>
    </div>
  );
}
