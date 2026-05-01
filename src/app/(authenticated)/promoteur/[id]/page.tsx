import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { findProgrammeForRole } from "@/lib/promoter/access";

export const metadata: Metadata = { title: "Tableau de bord programme" };

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProgrammeDashboardPage({ params }: PageProps) {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);
  const { id } = await params;

  const programme = await findProgrammeForRole(id, me.id, me.role);
  if (!programme) notFound();

  const [lots, lotStats] = await Promise.all([
    prisma.lot.findMany({
      where: { programmeId: id },
      select: { surface: true, priceTTC: true, status: true },
    }),
    prisma.lot.groupBy({
      by: ["status"],
      where: { programmeId: id },
      _count: { _all: true },
    }),
  ]);

  const total = lots.length;
  const counts = {
    AVAILABLE: 0,
    RESERVED: 0,
    SOLD: 0,
    WITHDRAWN: 0,
  } as Record<string, number>;
  for (const row of lotStats) counts[row.status] = row._count._all;

  const sold = counts["SOLD"] ?? 0;
  const reserved = counts["RESERVED"] ?? 0;
  const available = counts["AVAILABLE"] ?? 0;

  const realisedCa = lots
    .filter((l) => l.status === "SOLD")
    .reduce((acc, l) => acc + Number(l.priceTTC), 0);
  const objective = programme.caObjective
    ? Number(programme.caObjective)
    : null;

  // Prix moyen au m² sur les lots ayant une surface > 0.
  const validLots = lots.filter((l) => Number(l.surface) > 0);
  const avgPriceM2 =
    validLots.length > 0
      ? validLots.reduce(
          (acc, l) => acc + Number(l.priceTTC) / Number(l.surface),
          0,
        ) / validLots.length
      : 0;

  const soldPercent = total > 0 ? Math.round((sold / total) * 100) : 0;
  const reservedPercent = total > 0 ? Math.round((reserved / total) * 100) : 0;
  const caPercent =
    objective && objective > 0 ? Math.round((realisedCa / objective) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-equatis-night-700 font-mono text-xs uppercase">
          {programme.reference}
        </p>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          {programme.name}
        </h1>
        {programme.city && (
          <p className="mt-1 text-sm text-slate-600">{programme.city}</p>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Lots vendus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {sold} / {total}
            </p>
            <Bar percent={soldPercent} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lots réservés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {reserved} / {total}
            </p>
            <Bar percent={reservedPercent} variant="warning" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d&apos;affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {eur.format(realisedCa)}
            </p>
            {objective && (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  sur objectif {eur.format(objective)} ({caPercent}%)
                </p>
                <Bar percent={caPercent} variant="accent" />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Statistiques</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Disponibles" value={available} />
          <Stat label="Réservés" value={reserved} />
          <Stat label="Vendus" value={sold} />
          <Stat label="Prix moyen / m²" value={eur.format(avgPriceM2)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/promoteur/${id}/lots`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Voir la grille de prix &amp; lots
        </Link>
        <Link
          href={`/promoteur/${id}/tresorerie`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Trésorerie prévisionnelle
        </Link>
        <Link
          href={`/promoteur/${id}/ventes`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Suivi des ventes
        </Link>
      </div>
    </div>
  );
}

function Bar({
  percent,
  variant = "default",
}: {
  percent: number;
  variant?: "default" | "warning" | "accent";
}) {
  const color =
    variant === "warning"
      ? "bg-amber-500"
      : variant === "accent"
        ? "bg-equatis-turquoise-500"
        : "bg-emerald-500";
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`${color} h-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-equatis-night-800 mt-0.5 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}
