import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mes programmes" };

export default async function PromoteurHomePage() {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  const programmes =
    me.role === "SUPER_ADMIN"
      ? await prisma.programme.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          include: { _count: { select: { lots: true } } },
        })
      : await prisma.programme.findMany({
          where: {
            status: "ACTIVE",
            promoters: { some: { promoterId: me.id } },
          },
          orderBy: { name: "asc" },
          include: { _count: { select: { lots: true } } },
        });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Mes programmes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sélectionnez un programme pour accéder à son tableau de bord.
        </p>
      </div>

      {programmes.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-slate-500">
              Aucun programme ne vous est actuellement assigné. Contactez
              l&apos;administrateur Équatis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => (
            <Link
              key={p.id}
              href={`/promoteur/${p.id}`}
              className="hover:ring-equatis-turquoise-500 block rounded-lg ring-1 ring-slate-200 transition hover:ring-2"
            >
              <Card className="h-full border-0 shadow-none ring-0">
                <CardHeader>
                  <p className="text-equatis-night-700 font-mono text-xs">
                    {p.reference}
                  </p>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  <p>{p._count.lots} lots</p>
                  {p.city && <p className="text-xs text-slate-500">{p.city}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
