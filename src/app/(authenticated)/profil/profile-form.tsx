"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { updateClientProfileAction } from "@/lib/client-space/actions";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/lib/client-space/schemas";

export function ProfileForm({ initial }: { initial: UpdateProfileInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: initial,
  });

  function onSubmit(values: UpdateProfileInput) {
    setGlobalError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateClientProfileAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof UpdateProfileInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      setSuccess(true);
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
      {success && (
        <Alert variant="success" role="status">
          Coordonnées mises à jour.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Prénom"
          htmlFor="firstName"
          required
          error={form.formState.errors.firstName?.message}
        >
          <Input {...form.register("firstName")} />
        </FormField>
        <FormField
          label="Nom"
          htmlFor="lastName"
          required
          error={form.formState.errors.lastName?.message}
        >
          <Input {...form.register("lastName")} />
        </FormField>
      </div>

      <FormField
        label="Téléphone"
        htmlFor="phone"
        required
        error={form.formState.errors.phone?.message}
      >
        <Input type="tel" {...form.register("phone")} />
      </FormField>

      <FormField
        label="Adresse postale"
        htmlFor="addressLine"
        required
        error={form.formState.errors.addressLine?.message}
      >
        <Input {...form.register("addressLine")} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          label="Code postal"
          htmlFor="postalCode"
          required
          error={form.formState.errors.postalCode?.message}
        >
          <Input {...form.register("postalCode")} />
        </FormField>
        <FormField
          label="Ville"
          htmlFor="city"
          required
          className="sm:col-span-2"
          error={form.formState.errors.city?.message}
        >
          <Input {...form.register("city")} />
        </FormField>
      </div>

      <FormField
        label="Pays"
        htmlFor="country"
        required
        error={form.formState.errors.country?.message}
      >
        <Input {...form.register("country")} />
      </FormField>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Mise à jour…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
