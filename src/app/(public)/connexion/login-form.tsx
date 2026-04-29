"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export function LoginForm({ from }: { from?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false, from },
  });

  function onSubmit(values: LoginInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await loginAction({ ...values, from });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof LoginInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.replace(result.value.redirectTo);
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

      <FormField
        label="Mot de passe"
        htmlFor="password"
        required
        error={form.formState.errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
      </FormField>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            className="text-equatis-turquoise-600 focus:ring-equatis-turquoise-500 size-4 rounded border-slate-300"
            {...form.register("remember")}
          />
          Se souvenir de moi
        </label>
        <Link
          href="/mot-de-passe-oublie"
          className="text-equatis-turquoise-700 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <Button type="submit" block disabled={pending}>
        {pending ? "Connexion en cours…" : "Se connecter"}
      </Button>
    </form>
  );
}
