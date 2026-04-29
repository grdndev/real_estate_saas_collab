"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { createProgrammeAction } from "@/lib/admin/actions";
import {
  createProgrammeSchema,
  type CreateProgrammeInput,
} from "@/lib/admin/schemas";

export function ProgrammeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<CreateProgrammeInput>({
    resolver: zodResolver(createProgrammeSchema),
    defaultValues: {
      reference: "",
      name: "",
      description: "",
      city: "",
      caObjective: undefined,
    },
  });

  function onSubmit(values: CreateProgrammeInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await createProgrammeAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof CreateProgrammeInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.replace(`/admin/programmes/${result.value.id}`);
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
    >
      {globalError && (
        <Alert variant="danger" role="alert">
          {globalError}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Référence"
          htmlFor="reference"
          required
          hint="Identifiant interne (ex: ANTARES, DUPARC)"
          error={form.formState.errors.reference?.message}
        >
          <Input
            autoFocus
            className="font-mono uppercase"
            {...form.register("reference")}
          />
        </FormField>
        <FormField
          label="Ville"
          htmlFor="city"
          error={form.formState.errors.city?.message}
        >
          <Input {...form.register("city")} />
        </FormField>
      </div>
      <FormField
        label="Nom du programme"
        htmlFor="name"
        required
        error={form.formState.errors.name?.message}
      >
        <Input {...form.register("name")} />
      </FormField>
      <FormField
        label="Description"
        htmlFor="description"
        error={form.formState.errors.description?.message}
      >
        <Textarea rows={4} {...form.register("description")} />
      </FormField>
      <FormField
        label="Objectif chiffre d'affaires (€)"
        htmlFor="caObjective"
        hint="Optionnel — utilisé dans le tableau de bord promoteur"
        error={form.formState.errors.caObjective?.message}
      >
        <Input
          type="number"
          step="0.01"
          min="0"
          {...form.register("caObjective", {
            setValueAs: (v) =>
              v === "" || v === null || v === undefined ? null : Number(v),
          })}
        />
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.back()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le programme"}
        </Button>
      </div>
    </form>
  );
}
