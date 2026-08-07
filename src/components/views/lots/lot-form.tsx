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
import { updateLotAction } from "@/lib/admin/actions";
import { updateLotSchema, type UpdateLotInput } from "@/lib/admin/schemas";

/**
 * Lot sérialisé pour le client : les `Decimal` Prisma ne franchissent pas la
 * frontière serveur → client, la page appelante les convertit en `number`.
 */
export interface LotFormInitial {
  id: string;
  programmeId: string;
  reference: string;
  building: string | null;
  floor: number | null;
  type: string;
  notes: string | null;
  surface: number;
  annexSurface: number | null;
  suv: number | null;
  garden: number | null;
  priceHT: number;
  vatRate: number;
  priceTTC: number;
  priceNetVendeur: number | null;
  priceNetVendeurWithParking: number | null;
  commissionAgence: number | null;
  commissionAgenceParking: number | null;
  priceLocation: number | null;
  creditImpot35: number | null;
  priceRevientCrdImp: number | null;
  additionalParking: boolean | null;
}

/** Champ numérique facultatif : chaîne vide → `null`, jamais `NaN`. */
const asOptionalNumber = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : Number(v);

/**
 * Formulaire d'édition d'un lot — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin.
 *
 * Le statut du lot n'y figure pas : il est piloté par le cycle de vie du
 * dossier (réservation, envoi notaire, acte signé). Le programme de
 * rattachement n'est pas modifiable non plus.
 */
export function LotForm({
  lot,
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath,
}: {
  lot: LotFormInitial;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const lotPath = `${basePath}/${lot.id}`;

  const form = useForm<UpdateLotInput>({
    resolver: zodResolver(updateLotSchema),
    defaultValues: {
      id: lot.id,
      programmeId: lot.programmeId,
      reference: lot.reference,
      building: lot.building ?? "",
      floor: lot.floor,
      type: lot.type,
      notes: lot.notes ?? "",
      surface: lot.surface,
      annexSurface: lot.annexSurface,
      suv: lot.suv,
      garden: lot.garden,
      priceHT: lot.priceHT,
      vatRate: lot.vatRate,
      priceTTC: lot.priceTTC,
      priceNetVendeur: lot.priceNetVendeur,
      priceNetVendeurWithParking: lot.priceNetVendeurWithParking,
      commissionAgence: lot.commissionAgence,
      commissionAgenceParking: lot.commissionAgenceParking,
      priceLocation: lot.priceLocation,
      creditImpot35: lot.creditImpot35,
      priceRevientCrdImp: lot.priceRevientCrdImp,
      additionalParking: lot.additionalParking ?? false,
    },
  });

  const errors = form.formState.errors;

  function onSubmit(values: UpdateLotInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await updateLotAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof UpdateLotInput, { message: first });
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

  /** Montant € facultatif — même traitement pour les 7 champs financiers. */
  const amountField = (
    label: string,
    name: keyof UpdateLotInput,
    hint?: string,
  ) => (
    <FormField
      label={label}
      htmlFor={`lot-${name}`}
      hint={hint}
      error={errors[name]?.message}
    >
      <Input
        type="number"
        step="0.01"
        min="0"
        {...form.register(name, { setValueAs: asOptionalNumber })}
      />
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
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <FormField
            label="Référence"
            htmlFor="lot-reference"
            required
            error={errors.reference?.message}
          >
            <Input
              autoFocus
              className="font-mono uppercase"
              placeholder="A101"
              {...form.register("reference")}
            />
          </FormField>
          <FormField
            label="Localisation"
            htmlFor="lot-building"
            hint="Bâtiment, aile…"
            error={errors.building?.message}
          >
            <Input placeholder="Bât. A" {...form.register("building")} />
          </FormField>
          <FormField
            label="Étage"
            htmlFor="lot-floor"
            error={errors.floor?.message}
          >
            <Input
              type="number"
              {...form.register("floor", { setValueAs: asOptionalNumber })}
            />
          </FormField>
          <FormField
            label="Type"
            htmlFor="lot-type"
            required
            error={errors.type?.message}
          >
            <Input placeholder="T2" {...form.register("type")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surfaces</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <FormField
            label="Surface habitable (m²)"
            htmlFor="lot-surface"
            required
            error={errors.surface?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register("surface", { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            label="Surface annexes (m²)"
            htmlFor="lot-annexSurface"
            error={errors.annexSurface?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("annexSurface", {
                setValueAs: asOptionalNumber,
              })}
            />
          </FormField>
          <FormField
            label="Surface utile SUV (m²)"
            htmlFor="lot-suv"
            hint="Valeur saisie telle quelle, aucun recalcul"
            error={errors.suv?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("suv", { setValueAs: asOptionalNumber })}
            />
          </FormField>
          <FormField
            label="Jardin (m²)"
            htmlFor="lot-garden"
            error={errors.garden?.message}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("garden", { setValueAs: asOptionalNumber })}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prix</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Les trois valeurs sont saisies indépendamment : aucune n'est
              recalculée à partir des deux autres. */}
          <FormField
            label="Prix HT (€)"
            htmlFor="lot-priceHT"
            required
            error={errors.priceHT?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register("priceHT", { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            label="TVA (%)"
            htmlFor="lot-vatRate"
            required
            error={errors.vatRate?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register("vatRate", { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            label="Prix FAI (€)"
            htmlFor="lot-priceTTC"
            required
            hint="Prix TTC frais d'agence inclus"
            error={errors.priceTTC?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register("priceTTC", { valueAsNumber: true })}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financier</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {amountField("Prix net vendeur (€)", "priceNetVendeur")}
          {amountField(
            "NV avec place parking (€)",
            "priceNetVendeurWithParking",
          )}
          {amountField("Commission agence (€)", "commissionAgence")}
          {amountField("CA pour place parking (€)", "commissionAgenceParking")}
          {amountField("Prix à la location (€)", "priceLocation")}
          {amountField("Crédit d'impôt 35% (€)", "creditImpot35")}
          {amountField(
            "Prix de revient (avec CRD imp.) (€)",
            "priceRevientCrdImp",
          )}
          <FormField
            label="Parking supplémentaire"
            htmlFor="lot-additionalParking"
            error={errors.additionalParking?.message}
          >
            <label className="flex h-11 items-center gap-2 text-sm text-slate-700">
              <input
                id="lot-additionalParking"
                type="checkbox"
                className="size-4 rounded border-slate-300"
                {...form.register("additionalParking")}
              />
              Le lot comprend une place supplémentaire
            </label>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            label="Notes internes"
            htmlFor="lot-notes"
            hint="Visible par l'équipe interne uniquement"
            error={errors.notes?.message}
          >
            <Textarea rows={3} {...form.register("notes")} />
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
