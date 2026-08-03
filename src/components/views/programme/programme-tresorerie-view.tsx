import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Th, THead, Tr } from "@/components/ui/table";
import { TreasuryRow } from "@/components/promoter/treasury-row";
import { TreasuryChart } from "@/components/promoter/treasury-chart";
import type { Prisma } from "@/generated/prisma/client";
import type { LotStatus } from "@/generated/prisma/enums";

/**
 * Vue « trésorerie prévisionnelle d'un programme » — implémentation unique
 * partagée par l'espace promoteur et l'espace admin (T3/T15).
 */
interface Props {
  programme: { id: string; name: string; caObjective: Prisma.Decimal | null };
  /** 12 mois glissants, calculés par la route. */
  months: Date[];
  entries: { month: Date; income: Prisma.Decimal; expense: Prisma.Decimal }[];
  lots: { status: LotStatus; priceTTC: Prisma.Decimal }[];
  /** Préfixe de l'espace appelant, ex. « /admin/suivi » ou « /promoteur ». */
  basePath: string;
}

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ProgrammeTresorerieView({
  programme,
  months,
  entries,
  lots,
  basePath,
}: Props) {
  const id = programme.id;

  let caSold = 0;
  let caReserved = 0;
  let caOptioned = 0;
  let caAvailable = 0;
  let caWithdrawn = 0;
  let countSold = 0;
  let countReserved = 0;
  let countOptioned = 0;
  let countAvailable = 0;
  let countWithdrawn = 0;
  for (const lot of lots) {
    const price = Number(lot.priceTTC);
    switch (lot.status) {
      case "SOLD":
        caSold += price;
        countSold++;
        break;
      case "RESERVED":
        caReserved += price;
        countReserved++;
        break;
      case "OPTIONED":
        caOptioned += price;
        countOptioned++;
        break;
      case "AVAILABLE":
        caAvailable += price;
        countAvailable++;
        break;
      case "WITHDRAWN":
        caWithdrawn += price;
        countWithdrawn++;
        break;
    }
  }
  const caForecast = caSold + caReserved + caOptioned + caAvailable;
  const caObjective = programme.caObjective ? Number(programme.caObjective) : 0;
  const pctAchieved =
    caObjective > 0 ? Math.round((caSold / caObjective) * 100) : 0;
  const pctEngaged =
    caObjective > 0
      ? Math.round(((caSold + caReserved) / caObjective) * 100)
      : 0;
  const byKey = new Map(entries.map((e) => [monthKey(e.month), e]));

  let totalIncome = 0;
  let totalExpense = 0;
  for (const e of entries) {
    totalIncome += Number(e.income);
    totalExpense += Number(e.expense);
  }

  const chartData = months.map((d) => {
    const entry = byKey.get(monthKey(d));
    return {
      label: `${MONTH_NAMES[d.getUTCMonth()]!.slice(0, 3)}. ${String(d.getUTCFullYear()).slice(2)}`,
      income: entry ? Number(entry.income) : 0,
      expense: entry ? Number(entry.expense) : 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Trésorerie prévisionnelle
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {programme.name} — 12 mois glissants à partir du mois courant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Synthèse automatique — calculée depuis la grille des lots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800 uppercase">
                Vendu
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {eur.format(caSold)}
              </p>
              <p className="text-xs text-emerald-700">
                {countSold} lot{countSold > 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 uppercase">
                Réservé
              </p>
              <p className="mt-1 text-xl font-bold text-amber-700">
                {eur.format(caReserved)}
              </p>
              <p className="text-xs text-amber-700">
                {countReserved} lot{countReserved > 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-semibold text-violet-800 uppercase">
                Optionné
              </p>
              <p className="mt-1 text-xl font-bold text-violet-700">
                {eur.format(caOptioned)}
              </p>
              <p className="text-xs text-violet-700">
                {countOptioned} lot{countOptioned > 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-semibold text-sky-800 uppercase">
                Disponible
              </p>
              <p className="mt-1 text-xl font-bold text-sky-700">
                {eur.format(caAvailable)}
              </p>
              <p className="text-xs text-sky-700">
                {countAvailable} lot{countAvailable > 1 ? "s" : ""}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-800 uppercase">
                Retiré
              </p>
              <p className="mt-1 text-xl font-bold text-slate-700">
                {eur.format(caWithdrawn)}
              </p>
              <p className="text-xs text-slate-700">
                {countWithdrawn} lot{countWithdrawn > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">CA prévisionnel total</p>
              <p className="text-equatis-night-800 text-2xl font-bold">
                {eur.format(caForecast)}
              </p>
              <p className="text-xs text-slate-500">
                = vendu + réservé + optionné + disponible
              </p>
            </div>
            {caObjective > 0 && (
              <div>
                <p className="text-xs text-slate-500">
                  Objectif CA programme : {eur.format(caObjective)}
                </p>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bg-equatis-turquoise-600 h-full"
                    style={{ width: `${Math.min(pctEngaged, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  <strong>{pctAchieved}%</strong> acquis ·{" "}
                  <strong>{pctEngaged}%</strong> engagé (vendu + réservé)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total entrées prévues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">
              {eur.format(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total dépenses prévues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">
              {eur.format(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Solde prévisionnel</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalIncome - totalExpense < 0
                  ? "text-red-700"
                  : "text-equatis-night-800"
              }`}
            >
              {eur.format(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flux mensuels — 12 mois glissants</CardTitle>
        </CardHeader>
        <CardContent>
          <TreasuryChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tableau mensuel</CardTitle>
            <div className="flex items-center gap-4">
              <a
                href={`${basePath}/${id}/tresorerie/export-pdf`}
                className="text-equatis-turquoise-700 text-xs hover:underline"
                download
              >
                Exporter (PDF)
              </a>
              <a
                href={`${basePath}/${id}/tresorerie/export`}
                className="text-equatis-turquoise-700 text-xs hover:underline"
                download
              >
                Exporter (CSV)
              </a>
            </div>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <Tr>
              <Th>Mois</Th>
              <Th className="text-right">Entrées (€)</Th>
              <Th className="text-right">Dépenses (€)</Th>
              <Th className="text-right">Solde</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {months.map((d) => {
              const key = monthKey(d);
              const entry = byKey.get(key);
              const monthLabel = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
              return (
                <TreasuryRow
                  key={key}
                  programmeId={id}
                  monthIso={key}
                  monthLabel={monthLabel}
                  initialIncome={entry ? Number(entry.income) : 0}
                  initialExpense={entry ? Number(entry.expense) : 0}
                />
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
