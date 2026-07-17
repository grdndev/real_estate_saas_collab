"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createClientAndDossierAction } from "@/lib/dossier/actions";
import {
  createClientAndDossierSchema,
  type CreateClientAndDossierInput,
} from "@/lib/dossier/schemas";
import { FAMILY_STATUS_LABEL } from "@/lib/client-profile/schemas";

interface ProgrammeOption {
  id: string;
  name: string;
  lots: { id: string; reference: string; type: string }[];
}

export function ClientCreateForm({
  programmes,
}: {
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const cniRef = useRef<HTMLInputElement>(null);
  const contratRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateClientAndDossierInput>({
    resolver: zodResolver(createClientAndDossierSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      programmeId: "",
      lotId: null,
      initialNote: "",
      birthName: "",
      birthDate: "",
      birthPlace: "",
      profession: "",
      nationality: "",
      addressLine: "",
      postalCode: "",
      city: "",
      country: "",
      familyStatus: "",
      marriageDate: "",
      marriagePlace: "",
      marriageContract: "",
      notaryAppointmentAt: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- safe pattern for derived form state
  const programmeId = form.watch("programmeId");
  const programme = programmes.find((p) => p.id === programmeId);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.slice(r.indexOf(",") + 1));
      };
      reader.onerror = () => reject(new Error("Lecture impossible."));
      reader.readAsDataURL(file);
    });
  }

  function onSubmit(values: CreateClientAndDossierInput) {
    setGlobalError(null);
    startTransition(async () => {
      const cniFile = cniRef.current?.files?.[0];
      const contratFile = contratRef.current?.files?.[0];
      const result = await createClientAndDossierAction({
        ...values,
        lotId: values.lotId || null,
        phone: values.phone || undefined,
        cniFileB64: cniFile ? await fileToBase64(cniFile) : "",
        cniFileName: cniFile?.name ?? "",
        marriageContractFileB64: contratFile
          ? await fileToBase64(contratFile)
          : "",
        marriageContractFileName: contratFile?.name ?? "",
      });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof CreateClientAndDossierInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.replace(`/collaborateur/dossiers/${result.value.dossierId}`);
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

      <Alert variant="info">
        Un compte client sera créé. Un email d&apos;invitation Brevo sera envoyé
        à l&apos;adresse renseignée avec un lien pour définir le mot de passe
        (valable 7 jours).
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Prénom"
          htmlFor="firstName"
          required
          error={form.formState.errors.firstName?.message}
        >
          <Input autoFocus {...form.register("firstName")} />
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
        label="Email"
        htmlFor="email"
        required
        hint="Le client recevra ses identifiants à cette adresse."
        error={form.formState.errors.email?.message}
      >
        <Input type="email" {...form.register("email")} />
      </FormField>

      <FormField
        label="Téléphone"
        htmlFor="phone"
        hint="Optionnel — chiffré en base de données"
        error={form.formState.errors.phone?.message}
      >
        <Input type="tel" {...form.register("phone")} />
      </FormField>

      <FormField
        label="Programme"
        htmlFor="programmeId"
        required
        error={form.formState.errors.programmeId?.message}
      >
        <Select {...form.register("programmeId")}>
          <option value="">Sélectionner un programme…</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Lot"
        htmlFor="lotId"
        hint="Optionnel — peut être attribué plus tard"
        error={form.formState.errors.lotId?.message}
      >
        <Select
          {...form.register("lotId", {
            setValueAs: (v) => (v === "" ? null : v),
          })}
          disabled={!programme || programme.lots.length === 0}
        >
          <option value="">— Aucun lot pour le moment —</option>
          {programme?.lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.reference} ({lot.type})
            </option>
          ))}
        </Select>
      </FormField>

      <div className="rounded-md border border-slate-200 p-4">
        <p className="text-equatis-night-800 text-sm font-semibold">
          Fiche client
        </p>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">
          Informations facultatives — complétables aussi plus tard depuis la
          fiche client du dossier.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nom de naissance" htmlFor="birthName">
            <Input {...form.register("birthName")} />
          </FormField>
          <FormField label="Nationalité" htmlFor="nationality">
            <Input {...form.register("nationality")} />
          </FormField>
          <FormField label="Date de naissance" htmlFor="birthDate">
            <Input type="date" {...form.register("birthDate")} />
          </FormField>
          <FormField label="Lieu de naissance" htmlFor="birthPlace">
            <Input {...form.register("birthPlace")} />
          </FormField>
          <FormField label="Profession" htmlFor="profession">
            <Input {...form.register("profession")} />
          </FormField>
          <FormField label="Situation familiale" htmlFor="familyStatus">
            <Select {...form.register("familyStatus")}>
              <option value="">— Non renseignée —</option>
              {Object.entries(FAMILY_STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label="Adresse"
            htmlFor="addressLine"
            hint="Chiffrée en base"
          >
            <Input {...form.register("addressLine")} />
          </FormField>
          <FormField label="Code postal" htmlFor="postalCode">
            <Input {...form.register("postalCode")} />
          </FormField>
          <FormField label="Ville" htmlFor="city">
            <Input {...form.register("city")} />
          </FormField>
          <FormField label="Pays" htmlFor="country">
            <Input {...form.register("country")} />
          </FormField>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Date de mariage" htmlFor="marriageDate">
            <Input type="date" {...form.register("marriageDate")} />
          </FormField>
          <FormField label="Lieu de mariage" htmlFor="marriagePlace">
            <Input {...form.register("marriagePlace")} />
          </FormField>
          <FormField label="Régime de mariage" htmlFor="marriageContract">
            <Input {...form.register("marriageContract")} />
          </FormField>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 p-4">
        <p className="text-equatis-night-800 text-sm font-semibold">
          Pièces justificatives &amp; rendez-vous notaire
        </p>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">
          Déposez les pièces dès maintenant (PDF) — sinon elles pourront être
          ajoutées plus tard depuis le dossier.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Pièce d'identité (CNI)" htmlFor="cni-file">
            <Input
              id="cni-file"
              type="file"
              accept="application/pdf,.pdf"
              ref={cniRef}
            />
          </FormField>
          <FormField label="Contrat de mariage" htmlFor="contrat-file">
            <Input
              id="contrat-file"
              type="file"
              accept="application/pdf,.pdf"
              ref={contratRef}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField
            label="Rendez-vous notaire déjà fixé"
            htmlFor="notaryAppointmentAt"
            hint="Optionnel — si renseigné, le RDV apparaît dans les 3 espaces et déclenche la facturation"
          >
            <Input
              id="notaryAppointmentAt"
              type="datetime-local"
              {...form.register("notaryAppointmentAt")}
            />
          </FormField>
        </div>
      </div>

      <FormField
        label="Note interne"
        htmlFor="initialNote"
        hint="Visible dans la timeline du dossier"
        error={form.formState.errors.initialNote?.message}
      >
        <Textarea rows={3} {...form.register("initialNote")} />
      </FormField>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.back()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le client et le dossier"}
        </Button>
      </div>
    </form>
  );
}
