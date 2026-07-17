"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { upsertClientProfileAction } from "@/lib/client-profile/actions";
import { FAMILY_STATUS_LABEL } from "@/lib/client-profile/schemas";

export interface ClientProfileValues {
  firstName: string;
  lastName: string;
  phone: string;
  birthName: string;
  birthDate: string;
  birthPlace: string;
  profession: string;
  nationality: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  familyStatus: string;
  marriageDate: string;
  marriagePlace: string;
  marriageContract: string;
}

interface Props {
  dossierId: string;
  email: string;
  initial: ClientProfileValues;
}

export function ClientProfileForm({ dossierId, email, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ClientProfileValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ClientProfileValues>(
    key: K,
    value: ClientProfileValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertClientProfileAction({ dossierId, ...values });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-equatis-night-800 mb-2 text-sm font-semibold">
          Identité
        </legend>
        <FormField label="Nom de naissance" htmlFor="cp-birthName">
          <Input
            id="cp-birthName"
            value={values.birthName}
            onChange={(e) => set("birthName", e.target.value)}
          />
        </FormField>
        <FormField label="Nom d'usage" htmlFor="cp-lastName" required>
          <Input
            id="cp-lastName"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Prénom" htmlFor="cp-firstName" required>
          <Input
            id="cp-firstName"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Date de naissance" htmlFor="cp-birthDate">
          <Input
            id="cp-birthDate"
            type="date"
            value={values.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
        </FormField>
        <FormField label="Lieu de naissance" htmlFor="cp-birthPlace">
          <Input
            id="cp-birthPlace"
            value={values.birthPlace}
            onChange={(e) => set("birthPlace", e.target.value)}
          />
        </FormField>
        <FormField label="Nationalité" htmlFor="cp-nationality">
          <Input
            id="cp-nationality"
            value={values.nationality}
            onChange={(e) => set("nationality", e.target.value)}
          />
        </FormField>
        <FormField label="Profession" htmlFor="cp-profession">
          <Input
            id="cp-profession"
            value={values.profession}
            onChange={(e) => set("profession", e.target.value)}
          />
        </FormField>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-equatis-night-800 mb-2 text-sm font-semibold">
          Coordonnées
        </legend>
        <FormField label="Adresse email" htmlFor="cp-email">
          <Input id="cp-email" value={email} disabled />
        </FormField>
        <FormField label="Téléphone" htmlFor="cp-phone">
          <Input
            id="cp-phone"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Adresse" htmlFor="cp-addressLine">
            <Input
              id="cp-addressLine"
              value={values.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </FormField>
          <FormField label="Code postal" htmlFor="cp-postalCode">
            <Input
              id="cp-postalCode"
              value={values.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </FormField>
          <FormField label="Ville" htmlFor="cp-city">
            <Input
              id="cp-city"
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </FormField>
          <FormField label="Pays" htmlFor="cp-country">
            <Input
              id="cp-country"
              value={values.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="text-equatis-night-800 mb-2 text-sm font-semibold">
          Situation familiale
        </legend>
        <FormField label="Situation familiale" htmlFor="cp-familyStatus">
          <Select
            id="cp-familyStatus"
            value={values.familyStatus}
            onChange={(e) => set("familyStatus", e.target.value)}
          >
            <option value="">— Non renseigné —</option>
            {Object.entries(FAMILY_STATUS_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Date de mariage" htmlFor="cp-marriageDate">
          <Input
            id="cp-marriageDate"
            type="date"
            value={values.marriageDate}
            onChange={(e) => set("marriageDate", e.target.value)}
          />
        </FormField>
        <FormField label="Lieu de mariage" htmlFor="cp-marriagePlace">
          <Input
            id="cp-marriagePlace"
            value={values.marriagePlace}
            onChange={(e) => set("marriagePlace", e.target.value)}
          />
        </FormField>
        <FormField
          label="Contrat / régime de mariage"
          htmlFor="cp-marriageContract"
        >
          <Input
            id="cp-marriageContract"
            value={values.marriageContract}
            onChange={(e) => set("marriageContract", e.target.value)}
            placeholder="Communauté réduite aux acquêts, séparation de biens…"
          />
        </FormField>
      </fieldset>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert variant="success" role="status">
          Fiche client enregistrée.
        </Alert>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer la fiche client"}
        </Button>
      </div>
    </form>
  );
}
