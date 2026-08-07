"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createLotAction } from "@/lib/admin/actions";
import { lotSchema, type LotInput } from "@/lib/admin/schemas";

export function CreateLotForm({
  programmeId,
  /** Où rediriger après création — par défaut on reste sur place (grille). */
  redirectBasePath,
}: {
  programmeId: string;
  redirectBasePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<LotInput>({
    resolver: zodResolver(lotSchema),
    defaultValues: {
      programmeId,
      reference: "",
      surface: 0,
      annexSurface: null,
      suv: null,
      floor: 0,
      type: "T2",
      priceHT: 0,
      vatRate: 5.5,
      priceTTC: 0,
      status: "AVAILABLE",
    },
  });

  function onSubmit(values: LotInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await createLotAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof LotInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      if (redirectBasePath) {
        router.push(`${redirectBasePath}/${result.value.id}`);
        return;
      }
      form.reset({
        programmeId,
        reference: "",
        surface: 0,
        annexSurface: null,
        suv: null,
        floor: 0,
        type: "T2",
        priceHT: 0,
        vatRate: 5.5,
        priceTTC: 0,
        status: "AVAILABLE",
      });
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-5"
    >
      <input type="hidden" {...form.register("programmeId")} />
      <FormField
        label="Réf."
        htmlFor="lot-reference"
        required
        error={form.formState.errors.reference?.message}
      >
        <Input
          className="font-mono uppercase"
          placeholder="A101"
          {...form.register("reference")}
        />
      </FormField>
      <FormField
        label="Surface habitable (m²)"
        htmlFor="lot-surface"
        required
        error={form.formState.errors.surface?.message}
      >
        <Input
          type="number"
          step="0.01"
          {...form.register("surface", { valueAsNumber: true })}
        />
      </FormField>
      <FormField
        label="Surface annexe (m²)"
        htmlFor="lot-annexSurface"
        hint="Optionnel"
        error={form.formState.errors.annexSurface?.message}
      >
        <Input
          type="number"
          step="0.01"
          {...form.register("annexSurface", {
            setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
          })}
        />
      </FormField>
      <FormField
        label="Surface utile SUV (m²)"
        htmlFor="lot-suv"
        hint="Optionnel — valeur saisie telle quelle, aucun recalcul"
        error={form.formState.errors.suv?.message}
      >
        <Input
          type="number"
          step="0.01"
          {...form.register("suv", {
            setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
          })}
        />
      </FormField>
      <FormField
        label="Étage"
        htmlFor="lot-floor"
        error={form.formState.errors.floor?.message}
      >
        <Input
          type="number"
          {...form.register("floor", { valueAsNumber: true })}
        />
      </FormField>
      <FormField
        label="Type"
        htmlFor="lot-type"
        required
        error={form.formState.errors.type?.message}
      >
        <Input placeholder="T2" {...form.register("type")} />
      </FormField>
      {/* Les trois montants sont saisis indépendamment : aucun n'est recalculé
          à partir des deux autres. */}
      <FormField
        label="Prix HT (€)"
        htmlFor="lot-priceHT"
        required
        error={form.formState.errors.priceHT?.message}
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
        error={form.formState.errors.vatRate?.message}
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
        error={form.formState.errors.priceTTC?.message}
      >
        <Input
          type="number"
          step="0.01"
          {...form.register("priceTTC", { valueAsNumber: true })}
        />
      </FormField>
      <FormField
        label="Statut"
        htmlFor="lot-status"
        required
        error={form.formState.errors.status?.message}
      >
        <Select {...form.register("status")}>
          <option value="AVAILABLE">Disponible</option>
          <option value="OPTIONED">Optionné</option>
          <option value="RESERVED">Réservé</option>
          <option value="SOLD">Vendu</option>
          <option value="WITHDRAWN">Retiré</option>
        </Select>
      </FormField>
      {globalError && (
        <div className="sm:col-span-5">
          <Alert variant="danger" role="alert">
            {globalError}
          </Alert>
        </div>
      )}
      <div className="sm:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Ajout…" : "Ajouter le lot"}
        </Button>
      </div>
    </form>
  );
}
