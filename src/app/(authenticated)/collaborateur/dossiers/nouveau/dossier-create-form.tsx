"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createDossierAction } from "@/lib/dossier/actions";
import {
  createDossierSchema,
  type CreateDossierInput,
} from "@/lib/dossier/schemas";

interface ProgrammeOption {
  id: string;
  name: string;
  reference: string;
  lots: { id: string; reference: string; type: string }[];
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  programmes: ProgrammeOption[];
  collaborators: UserOption[];
  pendingClients: UserOption[];
  defaultCollaboratorId: string;
}

export function DossierCreateForm({
  programmes,
  collaborators,
  pendingClients,
  defaultCollaboratorId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<CreateDossierInput>({
    resolver: zodResolver(createDossierSchema),
    defaultValues: {
      programmeId: "",
      lotId: null,
      clientId: null,
      collaboratorId: defaultCollaboratorId,
      initialNote: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- safe pattern for derived form state
  const programmeId = form.watch("programmeId");
  const programme = programmes.find((p) => p.id === programmeId);

  function onSubmit(values: CreateDossierInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await createDossierAction({
        ...values,
        lotId: values.lotId || null,
        clientId: values.clientId || null,
      });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof CreateDossierInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.replace(`/collaborateur/dossiers/${result.value.id}`);
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
        label="Programme"
        htmlFor="programmeId"
        required
        error={form.formState.errors.programmeId?.message}
      >
        <Select autoFocus {...form.register("programmeId")}>
          <option value="">Sélectionner un programme…</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.reference})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Lot"
        htmlFor="lotId"
        hint="Optionnel — peut être attribué plus tard. Le lot passe en RÉSERVÉ."
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

      <FormField
        label="Client"
        htmlFor="clientId"
        hint={
          pendingClients.length === 0
            ? "Aucun client en attente d'association — créez le dossier sans client puis associez-le plus tard."
            : "Sélectionner un client inscrit en attente d'association."
        }
        error={form.formState.errors.clientId?.message}
      >
        <Select
          {...form.register("clientId", {
            setValueAs: (v) => (v === "" ? null : v),
          })}
        >
          <option value="">— Aucun client pour le moment —</option>
          {pendingClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} ({c.email})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Collaborateur référent"
        htmlFor="collaboratorId"
        required
        error={form.formState.errors.collaboratorId?.message}
      >
        <Select {...form.register("collaboratorId")}>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Note initiale"
        htmlFor="initialNote"
        hint="Optionnel — visible dans la timeline du dossier."
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
          {pending ? "Création…" : "Créer le dossier"}
        </Button>
      </div>
    </form>
  );
}
