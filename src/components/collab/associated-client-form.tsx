"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  createAssociatedClientAction,
  updateAssociatedClientAction,
} from "@/lib/client-account/actions";

/**
 * Création / modification d'un « client associé » sans compte (T7).
 *
 * Le même formulaire sert aux deux cas : `clientId` absent = création. Seuls le
 * nom et le prénom sont obligatoires — un client géré en interne peut n'avoir
 * aucune coordonnée.
 */
export interface AssociatedClientValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
}

const EMPTY: AssociatedClientValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine: "",
  postalCode: "",
  city: "",
  country: "",
};

interface Props {
  /** Absent = création d'une nouvelle fiche. */
  clientId?: string;
  initial?: AssociatedClientValues;
  /** Racine de la section, ex. « /admin/clients/associes ». */
  basePath: string;
}

export function AssociatedClientForm({ clientId, initial, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<AssociatedClientValues>(
    initial ?? EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  function set(key: keyof AssociatedClientValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = clientId
        ? await updateAssociatedClientAction({ ...values, clientId })
        : await createAssociatedClientAction(values);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (clientId) {
        setSaved(true);
        router.refresh();
        return;
      }
      router.push(basePath);
      router.refresh();
    });
  }

  const invalid =
    values.firstName.trim().length === 0 || values.lastName.trim().length === 0;

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {saved && <Alert variant="success">Fiche enregistrée.</Alert>}

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-equatis-night-800 mb-2 text-sm font-semibold">
          Identité
        </legend>
        <FormField
          label="Nom"
          htmlFor="ac-lastName"
          required
          error={fieldErrors.lastName?.[0]}
        >
          <Input
            id="ac-lastName"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </FormField>
        <FormField
          label="Prénom"
          htmlFor="ac-firstName"
          required
          error={fieldErrors.firstName?.[0]}
        >
          <Input
            id="ac-firstName"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </FormField>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-equatis-night-800 mb-2 text-sm font-semibold">
          Coordonnées
        </legend>
        <FormField
          label="Adresse email"
          htmlFor="ac-email"
          error={fieldErrors.email?.[0]}
          hint="Facultative. Renseignée, elle servira si vous ouvrez un accès plus tard — aucun email n'est envoyé tant que le client reste sans compte."
        >
          <Input
            id="ac-email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </FormField>
        <FormField
          label="Téléphone"
          htmlFor="ac-phone"
          error={fieldErrors.phone?.[0]}
        >
          <Input
            id="ac-phone"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Adresse" htmlFor="ac-addressLine">
            <Input
              id="ac-addressLine"
              value={values.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </FormField>
          <FormField label="Code postal" htmlFor="ac-postalCode">
            <Input
              id="ac-postalCode"
              value={values.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </FormField>
          <FormField label="Ville" htmlFor="ac-city">
            <Input
              id="ac-city"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </FormField>
          <FormField label="Pays" htmlFor="ac-country">
            <Input
              id="ac-country"
              value={values.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </FormField>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push(basePath)}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={pending || invalid}>
          {pending
            ? "Enregistrement…"
            : clientId
              ? "Enregistrer"
              : "Créer la fiche"}
        </Button>
      </div>
    </div>
  );
}
