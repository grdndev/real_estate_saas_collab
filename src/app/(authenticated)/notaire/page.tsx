import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dossierWhereForUser } from "@/lib/dossier/access";
import ListeDossiers from "./liste-dossiers";

export const metadata: Metadata = { title: "Dossiers reçus" };

export default async function NotaireDashboardPage() {
  const me = await requireRole(["NOTARY", "SUPER_ADMIN"]);
  const where = dossierWhereForUser(me.id, me.role);

  const dossiers = await prisma.dossier.findMany({
    where,
    orderBy: { notaryTransmittedAt: "desc" },
    include: {
      programme: { select: { name: true } },
      lots: { select: { reference: true } },
      client: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Dossiers reçus
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} transmis par
          les collaborateurs Équatis.
        </p>
      </div>

      <Card>
        {dossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier reçu"
            description="Les dossiers transmis par les collaborateurs Équatis apparaîtront ici."
          />
        ) : (
          <ListeDossiers dossiers={dossiers} />
        )}
      </Card>
    </div>
  );
}
