"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { signupClientAction } from "@/lib/auth/actions";
import { signupSchema, type SignupInput } from "@/lib/auth/schemas";

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      addressLine: "",
      postalCode: "",
      city: "",
      country: "France",
      password: "",
      passwordConfirmation: "",
      acceptTerms: undefined,
    },
  });

  function onSubmit(values: SignupInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await signupClientAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof SignupInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      setSuccess(result.value.email);
      form.reset();
    });
  }

  if (success) {
    return (
      <Alert variant="success" role="status">
        <p className="font-medium">Inscription enregistrée.</p>
        <p className="mt-1 text-sm">
          Un email de confirmation a été envoyé à <strong>{success}</strong>.
          Cliquez sur le lien (valable 24h) pour activer votre compte.
        </p>
      </Alert>
    );
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
          label="Prénom"
          htmlFor="firstName"
          required
          error={form.formState.errors.firstName?.message}
        >
          <Input autoComplete="given-name" {...form.register("firstName")} />
        </FormField>
        <FormField
          label="Nom"
          htmlFor="lastName"
          required
          error={form.formState.errors.lastName?.message}
        >
          <Input autoComplete="family-name" {...form.register("lastName")} />
        </FormField>
      </div>

      <FormField
        label="Adresse email"
        htmlFor="email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </FormField>

      <FormField
        label="Téléphone"
        htmlFor="phone"
        required
        hint="Numéro mobile pour suivi du dossier"
        error={form.formState.errors.phone?.message}
      >
        <Input type="tel" autoComplete="tel" {...form.register("phone")} />
      </FormField>

      <FormField
        label="Adresse postale"
        htmlFor="addressLine"
        required
        error={form.formState.errors.addressLine?.message}
      >
        <Input
          autoComplete="street-address"
          {...form.register("addressLine")}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          label="Code postal"
          htmlFor="postalCode"
          required
          error={form.formState.errors.postalCode?.message}
        >
          <Input autoComplete="postal-code" {...form.register("postalCode")} />
        </FormField>
        <FormField
          label="Ville"
          htmlFor="city"
          required
          className="sm:col-span-2"
          error={form.formState.errors.city?.message}
        >
          <Input autoComplete="address-level2" {...form.register("city")} />
        </FormField>
      </div>

      <FormField
        label="Pays"
        htmlFor="country"
        required
        error={form.formState.errors.country?.message}
      >
        <Input autoComplete="country-name" {...form.register("country")} />
      </FormField>

      <FormField
        label="Mot de passe"
        htmlFor="password"
        required
        hint="8 caractères minimum, dont 1 majuscule et 1 chiffre"
        error={form.formState.errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
      </FormField>

      <FormField
        label="Confirmation du mot de passe"
        htmlFor="passwordConfirmation"
        required
        error={form.formState.errors.passwordConfirmation?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...form.register("passwordConfirmation")}
        />
      </FormField>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="text-equatis-turquoise-600 mt-0.5 size-4 rounded border-slate-300"
          {...form.register("acceptTerms")}
        />
        <span>
          J&apos;accepte les{" "}
          <a
            href="/conditions"
            className="text-equatis-turquoise-700 hover:underline"
          >
            conditions d&apos;utilisation
          </a>{" "}
          et la{" "}
          <a
            href="/confidentialite"
            className="text-equatis-turquoise-700 hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </span>
      </label>
      {form.formState.errors.acceptTerms && (
        <p className="text-xs text-red-600">
          {form.formState.errors.acceptTerms.message}
        </p>
      )}

      <Button type="submit" block disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
