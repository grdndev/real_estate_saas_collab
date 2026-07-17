import type { Metadata } from "next";

import { PromoterImportWizard } from "@/components/promoter/promoter-import-wizard";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { programmesForPromoter } from "@/lib/promoter/access";

export const metadata: Metadata = { title: "Importer un programme" };

export default async function ImportProgrammePage() {
  const me = await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  const programmes = await prisma.programme.findMany({
    where:
      me.role === "PROMOTER"
        ? { id: { in: await programmesForPromoter(me.id) }, status: "ACTIVE" }
        : { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Importer un programme
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Déposez votre tableau de suivi Excel puis laissez-vous guider :
          programme, lots et dossiers sont créés étape par étape.
        </p>
      </div>

      <PromoterImportWizard programmes={programmes} />
    </div>
  );
}
