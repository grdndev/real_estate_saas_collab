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

  const lots = await prisma.lot.findMany({
    where: { programmeId: id },
    select: { surface: true, priceTTC: true, status: true },
  });

  // Suivi commercial : compte + CA prévisionnel par statut de lot.
  const view = {
    AVAILABLE: { count: 0, ca: 0 },
    OPTIONED: { count: 0, ca: 0 },
    RESERVED: { count: 0, ca: 0 },
    SOLD: { count: 0, ca: 0 },
    WITHDRAWN: { count: 0, ca: 0 },
  };
  for (const lot of lots) {
    const bucket = view[lot.status];
    bucket.count++;
    bucket.ca += Number(lot.priceTTC);
  }

  const total = lots.length;
  // CA prévisionnel total = lots commercialisables (hors retirés).
  const caTotal =
    view.AVAILABLE.ca + view.OPTIONED.ca + view.RESERVED.ca + view.SOLD.ca;
  const objective = programme.caObjective
    ? Number(programme.caObjective)
    : null;

  const validLots = lots.filter((l) => Number(l.surface) > 0);
  const avgPriceM2 =
    validLots.length > 0
      ? validLots.reduce(
          (acc, l) => acc + Number(l.priceTTC) / Number(l.surface),
          0,
        ) / validLots.length
      : 0;

  const caPercent =
    objective && objective > 0
      ? Math.round((view.SOLD.ca / objective) * 100)
      : 0;

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

      {/* Suivi commercial — une vue par statut, avec CA prévisionnel. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CommercialCard
          label="Optionnés"
          count={view.OPTIONED.count}
          ca={view.OPTIONED.ca}
          tone="violet"
        />
        <CommercialCard
          label="Réservés"
          count={view.RESERVED.count}
          ca={view.RESERVED.ca}
          tone="amber"
        />
        <CommercialCard
          label="Vendus"
          count={view.SOLD.count}
          ca={view.SOLD.ca}
          tone="emerald"
        />
        <CommercialCard
          label="Disponibles"
          count={view.AVAILABLE.count}
          ca={view.AVAILABLE.ca}
          tone="sky"
        />
        <CommercialCard label="Total" count={total} ca={caTotal} tone="night" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Chiffre d&apos;affaires réalisé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {eur.format(view.SOLD.ca)}
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
        <Card>
          <CardHeader>
            <CardTitle>Statistiques lots optionnés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {view.OPTIONED.count}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {total > 0
                ? `${Math.round((view.OPTIONED.count / total) * 100)}% du programme`
                : "—"}{" "}
              · CA potentiel {eur.format(view.OPTIONED.ca)}
            </p>
            <Bar
              percent={total > 0 ? (view.OPTIONED.count / total) * 100 : 0}
              variant="violet"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prix moyen / m²</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-equatis-night-800 text-3xl font-bold">
              {eur.format(avgPriceM2)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              sur {validLots.length} lot{validLots.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/promoteur/${id}/lots`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Grille de prix &amp; lots
        </Link>
        <Link
          href={`/promoteur/${id}/tresorerie`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Rapprochement bancaire / trésorerie
        </Link>
        <Link
          href={`/promoteur/${id}/ventes`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Suivi des ventes
        </Link>
        <Link
          href={`/promoteur/${id}/contrats`}
          className="text-equatis-turquoise-700 hover:underline"
        >
          → Suivi des contrats
        </Link>
      </div>
    </div>
  );
}

const TONES = {
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  night: "border-equatis-night-200 bg-equatis-night-50 text-equatis-night-800",
} as const;

function CommercialCard({
  label,
  count,
  ca,
  tone,
}: {
  label: string;
  count: number;
  ca: number;
  tone: keyof typeof TONES;
}) {
  return (
    <div className={`rounded-lg border p-3 ${TONES[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{count}</p>
      <p className="mt-0.5 text-xs opacity-80">{eur.format(ca)}</p>
      <p className="text-[10px] opacity-60">CA prévisionnel</p>
    </div>
  );
}

function Bar({
  percent,
  variant = "default",
}: {
  percent: number;
  variant?: "default" | "warning" | "accent" | "violet";
}) {
  const color =
    variant === "warning"
      ? "bg-amber-500"
      : variant === "accent"
        ? "bg-equatis-turquoise-500"
        : variant === "violet"
          ? "bg-violet-500"
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
