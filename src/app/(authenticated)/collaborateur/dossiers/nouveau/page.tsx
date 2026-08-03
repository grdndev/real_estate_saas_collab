import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { loadDossierCreationOptions } from "@/lib/dossier/list-access";
import { DossierCreateForm } from "@/components/views/dossiers/dossier-create-form";

export const metadata: Metadata = { title: "Nouveau dossier" };

export default async function NewDossierPage() {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);

  const { programmes, collaborators, pendingClients, defaultCollaboratorId } =
    await loadDossierCreationOptions(me.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/collaborateur/dossiers"
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux dossiers
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Nouveau dossier
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Créez un dossier vide ou associez immédiatement un client inscrit.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          {programmes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun programme actif. Demandez à l&apos;administrateur d&apos;en
              créer un.
            </p>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun collaborateur actif. Demandez à l&apos;administrateur
              d&apos;en inviter un.
            </p>
          ) : (
            <DossierCreateForm
              programmes={programmes}
              collaborators={collaborators}
              pendingClients={pendingClients}
              defaultCollaboratorId={defaultCollaboratorId}
              basePath="/collaborateur/dossiers"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
