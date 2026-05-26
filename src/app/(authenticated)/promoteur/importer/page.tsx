import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgrammeImportForm } from "@/components/promoter/programme-import-form";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Importer un programme" };

export default async function ImportProgrammePage() {
  await requireRole(["PROMOTER", "SUPER_ADMIN"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Importer un programme
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Déposez un fichier Excel : tous les lots sont créés automatiquement et
          le programme devient accessible à toute l&apos;équipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau programme depuis un fichier Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgrammeImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
