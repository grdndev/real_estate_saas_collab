"use client";

import { useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { CreateLotForm } from "@/components/admin/lot-form";

/**
 * Vue « nouveau lot » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin.
 *
 * Un lot appartient toujours à un programme : on le choisit d'abord, puis la
 * grille de saisie du lot s'affiche. Le client, lui, s'associe ensuite depuis
 * la fiche du lot (c'est cette association qui crée le dossier).
 */
interface Props {
  programmes: { id: string; name: string }[];
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

export function NewLotView({ programmes, basePath }: Props) {
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={basePath}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux lots
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Nouveau lot
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Créez le bien. Vous pourrez lui associer un client depuis sa fiche —
          c&apos;est cette association qui ouvre le dossier.
        </p>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Caractéristiques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {programmes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun programme actif. Demandez à l&apos;administrateur d&apos;en
              créer un.
            </p>
          ) : (
            <>
              <FormField label="Programme" htmlFor="lot-programme" required>
                <Select
                  id="lot-programme"
                  value={programmeId}
                  onChange={(e) => setProgrammeId(e.target.value)}
                >
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <CreateLotForm
                key={programmeId}
                programmeId={programmeId}
                redirectBasePath={basePath}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
