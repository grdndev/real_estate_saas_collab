"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { updateSettingsAction } from "@/lib/admin/actions";
import { settingsSchema, type SettingsInput } from "@/lib/admin/schemas";

interface Props {
  initial: {
    RELAUNCH_DELAY_DAYS: number;
    SESSION_INACTIVITY_MINUTES: number;
    AUTO_EMAILS_ENABLED: boolean;
  };
}

export function SettingsForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });

  function onSubmit(values: SettingsInput) {
    setGlobalError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof SettingsInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5"
    >
      {globalError && (
        <Alert variant="danger" role="alert">
          {globalError}
        </Alert>
      )}
      {success && (
        <Alert variant="success" role="status">
          Paramètres enregistrés.
        </Alert>
      )}

      <FormField
        label="Délai avant relance automatique (jours)"
        htmlFor="RELAUNCH_DELAY_DAYS"
        required
        hint="Un email de relance est envoyé après ce nombre de jours sans activité sur un dossier."
        error={form.formState.errors.RELAUNCH_DELAY_DAYS?.message}
      >
        <Input
          type="number"
          min="1"
          max="90"
          {...form.register("RELAUNCH_DELAY_DAYS", { valueAsNumber: true })}
        />
      </FormField>

      <FormField
        label="Durée d'inactivité avant déconnexion (minutes)"
        htmlFor="SESSION_INACTIVITY_MINUTES"
        required
        hint="Au-delà de cette durée sans interaction, la session est invalidée (CDC §3.3)."
        error={form.formState.errors.SESSION_INACTIVITY_MINUTES?.message}
      >
        <Input
          type="number"
          min="5"
          max="240"
          {...form.register("SESSION_INACTIVITY_MINUTES", {
            valueAsNumber: true,
          })}
        />
      </FormField>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="text-equatis-turquoise-600 size-4 rounded border-slate-300"
            {...form.register("AUTO_EMAILS_ENABLED")}
          />
          <span className="font-medium">Activer les emails automatiques</span>
        </label>
        <p className="mt-1 ml-6 text-xs text-slate-500">
          Bienvenue, association de dossier, nouveau document, relance,
          transmission notaire, acte prêt, etc.
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
