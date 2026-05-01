import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TreasuryRow } from "@/components/promoter/treasury-row";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";

export const metadata: Metadata = { title: "Trésorerie prévisionnelle" };

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeTreasuryPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;
  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  // 12 mois glissants à partir du mois courant.
  const today = new Date();
  const startMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );

  const months = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(startMonth);
    d.setUTCMonth(d.getUTCMonth() + idx);
    return d;
  });

  const entries = await prisma.tresoreriePrev.findMany({
    where: {
      programmeId: id,
      month: {
        gte: months[0],
        lte: months[months.length - 1],
      },
    },
  });
  const byKey = new Map(
    entries.map((e) => [
      `${e.month.getUTCFullYear()}-${String(e.month.getUTCMonth() + 1).padStart(2, "0")}`,
      e,
    ]),
  );

  let totalIncome = 0;
  let totalExpense = 0;
  for (const e of entries) {
    totalIncome += Number(e.income);
    totalExpense += Number(e.expense);
  }

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
          <div className="flex items-center justify-between">
            <CardTitle>Tableau mensuel</CardTitle>
            <a
              href={`/promoteur/${id}/tresorerie/export`}
              className="text-equatis-turquoise-700 text-xs hover:underline"
              download
            >
              Exporter (CSV)
            </a>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-equatis-night-700 border-b border-slate-200 bg-slate-50 text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Mois</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Entrées (€)
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Dépenses (€)
                </th>
                <th className="px-4 py-3 text-right font-semibold">Solde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((d) => {
                const monthIso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
                const entry = byKey.get(monthIso);
                const monthLabel = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
                return (
                  <TreasuryRow
                    key={monthIso}
                    programmeId={id}
                    monthIso={monthIso}
                    monthLabel={monthLabel}
                    initialIncome={entry ? Number(entry.income) : 0}
                    initialExpense={entry ? Number(entry.expense) : 0}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
