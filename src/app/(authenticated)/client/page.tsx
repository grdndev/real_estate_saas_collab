import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mes dossiers" };

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Sélecteur de dossier : un client peut acheter plusieurs lots, donc porter
 * plusieurs dossiers actifs. Avec un seul dossier, on l'ouvre directement.
 */
export default async function ClientDossiersPage() {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);

  const dossiers = await prisma.dossier.findMany({
    where: { clientId: me.id, archivedAt: null },
    orderBy: { lastActivityAt: "desc" },
    include: {
      lot: {
        select: {
          reference: true,
          type: true,
          surface: true,
          priceTTC: true,
          programme: { select: { name: true, city: true } },
        },
      },
    },
  });

  if (dossiers.length === 1) redirect(`/client/${dossiers[0]!.id}`);

  if (dossiers.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>En attente d&apos;association</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              Bonjour {me.name?.split(" ")[0] ?? ""}, votre compte est créé et
              votre adresse email est confirmée.
            </p>
            <p className="text-slate-600">
              Un collaborateur Équatis va prochainement vous associer à votre
              dossier d&apos;acquisition. Vous serez notifié(e) par email dès
              que votre dossier sera prêt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Mes dossiers
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dossiers.length} acquisition{dossiers.length > 1 ? "s" : ""} en
          cours. Choisissez le dossier à consulter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dossiers.map((d) => (
          <Link key={d.id} href={`/client/${d.id}`} className="block">
            <Card className="h-full transition hover:border-sky-300">
              <CardHeader>
                <CardTitle>
                  {d.lot.programme.name}
                  {d.lot.programme.city && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      · {d.lot.programme.city}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>
                  Lot <span className="font-mono">{d.lot.reference}</span> ·{" "}
                  {Number(d.lot.surface)} m² · {d.lot.type}
                </p>
                <p className="text-slate-600">
                  Prix TTC :{" "}
                  <strong>{eur.format(Number(d.lot.priceTTC))}</strong>
                </p>
                <p className="pt-1">
                  <Badge variant="info">Ouvrir le dossier →</Badge>
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
