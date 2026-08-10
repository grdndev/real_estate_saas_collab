"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateDossierTrackingAction } from "@/lib/dossier/actions";
import {
  updateDossierTrackingSchema,
  type UpdateDossierTrackingInput,
} from "@/lib/dossier/schemas";

/**
 * Suivi sérialisé pour le client : les `Decimal` et `Date` Prisma ne
 * franchissent pas la frontière serveur → client, la vue appelante les
 * convertit en `number` et en `YYYY-MM-DD`.
 */
export type DossierTrackingInitial = UpdateDossierTrackingInput;

/** Champ montant facultatif : chaîne vide → `null`, jamais `NaN`. */
const asOptionalNumber = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : Number(v);

/**
 * Formulaire d'édition du suivi complémentaire d'un dossier — les dates brutes
 * du process de vente affichées par `DossierSidePanel`.
 *
 * Les statuts (commercial, contractuel), l'option et le notaire n'y figurent
 * pas : ils ont chacun leur propre contrôle dans le panneau latéral du lot.
 */
export function DossierTrackingForm({
  tracking,
  /** Fiche du lot porteur du dossier, ex. « /admin/lots/abc ». */
  lotPath,
}: {
  tracking: DossierTrackingInitial;
  lotPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<UpdateDossierTrackingInput>({
    resolver: zodResolver(updateDossierTrackingSchema),
    defaultValues: tracking,
  });

  const errors = form.formState.errors;

  function onSubmit(values: UpdateDossierTrackingInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await updateDossierTrackingAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof UpdateDossierTrackingInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.push(lotPath);
      router.refresh();
    });
  }

  /** Date facultative — même traitement pour les 9 jalons du process. */
  const dateField = (label: string, name: keyof UpdateDossierTrackingInput) => (
    <FormField
      label={label}
      htmlFor={`tracking-${name}`}
      error={errors[name]?.message}
    >
      <Input type="date" {...form.register(name)} />
    </FormField>
  );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
    >
      {globalError && (
        <Alert variant="danger" role="alert">
          {globalError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Financement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Mode de financement"
            htmlFor="tracking-financingMode"
            hint="Prêt bancaire, comptant…"
            error={errors.financingMode?.message}
          >
            <Input autoFocus {...form.register("financingMode")} />
          </FormField>
          {dateField("Dépôt de prêt", "loanFiledAt")}
          {dateField("Obtention de prêt", "loanObtainedAt")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réservation</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {dateField("Signature contrat de résa", "reservationSignedAt")}
          {dateField("Date de fin de contrat de résa", "reservationEndDate")}
          {dateField("Réception des 200 €", "deposit200ReceivedAt")}
          <FormField
            label="Dépôt de garantie (€)"
            htmlFor="tracking-guaranteeDepositAmount"
            error={errors.guaranteeDepositAmount?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("guaranteeDepositAmount", {
                setValueAs: asOptionalNumber,
              })}
            />
          </FormField>
          {dateField(
            "Réception du dépôt de garantie",
            "guaranteeDepositReceivedAt",
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notaire et acte</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {dateField("Envoi RAR par le notaire", "rarSentByNotaryAt")}
          {dateField("Acte", "actSignedAt")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administratif</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {dateField("Obtention Kbis", "kbisObtainedAt")}
          <FormField
            label="Client chez RSM"
            htmlFor="tracking-clientAtRsm"
            error={errors.clientAtRsm?.message}
          >
            <Select {...form.register("clientAtRsm")}>
              <option value="">Non renseigné</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observation</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            label="Observation"
            htmlFor="tracking-observation"
            hint="Visible par l'équipe interne uniquement"
            error={errors.observation?.message}
          >
            <Textarea rows={3} {...form.register("observation")} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.push(lotPath)}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
