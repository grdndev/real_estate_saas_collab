"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { changeClientPasswordAction } from "@/lib/client-space/actions";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/client-space/schemas";

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  function onSubmit(values: ChangePasswordInput) {
    setGlobalError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await changeClientPasswordAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof ChangePasswordInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      setSuccess(true);
      form.reset();
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
          Mot de passe modifié. Les autres sessions actives ont été
          déconnectées.
        </Alert>
      )}

      <FormField
        label="Mot de passe actuel"
        htmlFor="currentPassword"
        required
        error={form.formState.errors.currentPassword?.message}
      >
        <Input
          type="password"
          autoComplete="current-password"
          {...form.register("currentPassword")}
        />
      </FormField>
      <FormField
        label="Nouveau mot de passe"
        htmlFor="newPassword"
        required
        hint="8 caractères minimum, dont 1 majuscule et 1 chiffre"
        error={form.formState.errors.newPassword?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...form.register("newPassword")}
        />
      </FormField>
      <FormField
        label="Confirmation"
        htmlFor="newPasswordConfirmation"
        required
        error={form.formState.errors.newPasswordConfirmation?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...form.register("newPasswordConfirmation")}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Mise à jour…" : "Changer mon mot de passe"}
        </Button>
      </div>
    </form>
  );
}
