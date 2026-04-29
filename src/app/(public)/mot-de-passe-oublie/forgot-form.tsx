"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { resetRequestSchema, type ResetRequestInput } from "@/lib/auth/schemas";

export function ForgotForm() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ResetRequestInput) {
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setSubmitted(true);
      } else if (result.fieldErrors?.email?.[0]) {
        form.setError("email", { message: result.fieldErrors.email[0] });
      }
    });
  }

  if (submitted) {
    return (
      <Alert variant="success" role="status">
        <p className="font-medium">Demande envoyée.</p>
        <p className="mt-1 text-sm">
          Si un compte existe avec cette adresse, vous recevrez un email
          contenant un lien de réinitialisation valable 2 heures.
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
      <FormField
        label="Adresse email"
        htmlFor="email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input
          type="email"
          autoComplete="email"
          autoFocus
          {...form.register("email")}
        />
      </FormField>
      <Button type="submit" block disabled={pending}>
        {pending ? "Envoi…" : "Recevoir un lien de réinitialisation"}
      </Button>
    </form>
  );
}
