import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { getCompanyLogo, getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres globaux" };

export default async function ParametresPage() {
  // Défense en profondeur : proxy.ts filtre déjà /admin, la garde revérifie ici.
  await requireRole("SUPER_ADMIN");

  const [settings, logo] = await Promise.all([getSettings(), getCompanyLogo()]);

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
          <SettingsForm initial={{ ...settings, COMPANY_LOGO: logo }} />
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
