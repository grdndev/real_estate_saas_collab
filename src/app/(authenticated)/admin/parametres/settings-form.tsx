"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { updateSettingsAction } from "@/lib/admin/actions";
import { settingsSchema, type SettingsInput } from "@/lib/admin/schemas";

// Taille max du fichier logo (500 Ko) — le data URL résultant reste < 700 Ko.
const LOGO_MAX_OCTETS = 500 * 1024;

interface Props {
  initial: {
    RELAUNCH_DELAY_DAYS: number;
    SESSION_INACTIVITY_MINUTES: number;
    AUTO_EMAILS_ENABLED: boolean;
    COMPANY_LOGO: string | null;
  };
}

export function SettingsForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });
  const logo = useWatch({ control: form.control, name: "COMPANY_LOGO" });

  function onLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setLogoError("Format non pris en charge : choisissez un PNG ou un JPEG.");
      event.target.value = "";
      return;
    }
    if (file.size > LOGO_MAX_OCTETS) {
      setLogoError("Fichier trop lourd : 500 Ko maximum.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      form.setValue("COMPANY_LOGO", reader.result as string, {
        shouldDirty: true,
      });
    };
    reader.onerror = () => {
      setLogoError("Impossible de lire le fichier. Réessayez.");
    };
    reader.readAsDataURL(file);
  }

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

      <FormField
        label="Logo de la société (en-tête documents)"
        htmlFor="COMPANY_LOGO"
        hint="Affiché en en-tête des documents PDF à la place du nom de la société. PNG ou JPEG, 500 Ko max, fond transparent recommandé."
        error={logoError ?? form.formState.errors.COMPANY_LOGO?.message}
      >
        <div className="space-y-3">
          {logo && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt="Logo actuel de la société"
                className="h-12 w-auto rounded border border-slate-200 bg-white p-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("COMPANY_LOGO", null, { shouldDirty: true })
                }
              >
                Retirer le logo
              </Button>
            </div>
          )}
          <Input
            id="COMPANY_LOGO"
            type="file"
            accept="image/png,image/jpeg"
            onChange={onLogoChange}
          />
        </div>
      </FormField>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
