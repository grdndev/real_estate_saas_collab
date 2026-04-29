import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres globaux" };

export default async function ParametresPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Paramètres globaux
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Configuration de la plateforme. Ces paramètres s&apos;appliquent à
          tous les espaces.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Plateforme</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Intégrations externes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>
            Les clés API (Brevo, Yousign, OVH Object Storage) sont configurées
            via les variables d&apos;environnement (fichier <code>.env</code> en
            dev, secrets de l&apos;hébergeur en production). Voir le fichier{" "}
            <code>.env.example</code> du dépôt pour la liste complète.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
