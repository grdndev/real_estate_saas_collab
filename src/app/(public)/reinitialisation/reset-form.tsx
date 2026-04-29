"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { applyPasswordResetAction } from "@/lib/auth/actions";
import { resetApplySchema, type ResetApplyInput } from "@/lib/auth/schemas";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetApplyInput>({
    resolver: zodResolver(resetApplySchema),
    defaultValues: { token, password: "", passwordConfirmation: "" },
  });

  function onSubmit(values: ResetApplyInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await applyPasswordResetAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof ResetApplyInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.replace("/connexion?reason=password_reset");
      }, 1500);
    });
  }

  if (done) {
    return (
      <Alert variant="success" role="status">
        Mot de passe réinitialisé. Redirection vers la page de connexion…
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
      <input type="hidden" {...form.register("token")} />
      <FormField
        label="Nouveau mot de passe"
        htmlFor="password"
        required
        hint="8 caractères, 1 majuscule, 1 chiffre"
        error={form.formState.errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          autoFocus
          {...form.register("password")}
        />
      </FormField>
      <FormField
        label="Confirmation"
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
      <Button type="submit" block disabled={pending}>
        {pending ? "Mise à jour…" : "Réinitialiser le mot de passe"}
      </Button>
    </form>
  );
}
