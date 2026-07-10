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
import { Select } from "@/components/ui/select";
import { FAMILY_STATUS_LABEL } from "@/lib/client-profile/schemas";

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

      <div className="border-t border-slate-100 pt-4">
        <p className="text-equatis-night-800 mb-3 text-sm font-semibold">
          État civil
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Nom de naissance"
            htmlFor="birthName"
            error={form.formState.errors.birthName?.message}
          >
            <Input {...form.register("birthName")} />
          </FormField>
          <FormField
            label="Date de naissance"
            htmlFor="birthDate"
            error={form.formState.errors.birthDate?.message}
          >
            <Input type="date" {...form.register("birthDate")} />
          </FormField>
          <FormField
            label="Lieu de naissance"
            htmlFor="birthPlace"
            error={form.formState.errors.birthPlace?.message}
          >
            <Input {...form.register("birthPlace")} />
          </FormField>
          <FormField
            label="Nationalité"
            htmlFor="nationality"
            error={form.formState.errors.nationality?.message}
          >
            <Input {...form.register("nationality")} />
          </FormField>
          <FormField
            label="Profession"
            htmlFor="profession"
            error={form.formState.errors.profession?.message}
          >
            <Input {...form.register("profession")} />
          </FormField>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-equatis-night-800 mb-3 text-sm font-semibold">
          Situation familiale
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Situation familiale"
            htmlFor="familyStatus"
            error={form.formState.errors.familyStatus?.message}
          >
            <Select {...form.register("familyStatus")}>
              <option value="">— Non renseigné —</option>
              {Object.entries(FAMILY_STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Date de mariage"
            htmlFor="marriageDate"
            error={form.formState.errors.marriageDate?.message}
          >
            <Input type="date" {...form.register("marriageDate")} />
          </FormField>
          <FormField
            label="Lieu de mariage"
            htmlFor="marriagePlace"
            error={form.formState.errors.marriagePlace?.message}
          >
            <Input {...form.register("marriagePlace")} />
          </FormField>
          <FormField
            label="Contrat / régime de mariage"
            htmlFor="marriageContract"
            error={form.formState.errors.marriageContract?.message}
          >
            <Input
              placeholder="Communauté réduite aux acquêts, séparation de biens…"
              {...form.register("marriageContract")}
            />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Mise à jour…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
