"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createProspectAction } from "@/lib/prospect/actions";
import {
  createProspectSchema,
  type CreateProspectInput,
} from "@/lib/prospect/schemas";

interface Props {
  programmes: { id: string; name: string; reference: string }[];
}

export function ProspectCreateForm({ programmes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<CreateProspectInput>({
    resolver: zodResolver(createProspectSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      programmeId: "",
      source: "manual",
      notes: "",
    },
  });

  function onSubmit(values: CreateProspectInput) {
    setGlobalError(null);
    setSuccess(false);
    startTransition(async () => {
      const payload: CreateProspectInput = {
        ...values,
        programmeId: values.programmeId || null,
      };
      const result = await createProspectAction(payload);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof CreateProspectInput, {
                message: first,
              });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      form.reset();
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-6"
    >
      <FormField
        label="Prénom"
        htmlFor="p-firstName"
        required
        error={form.formState.errors.firstName?.message}
      >
        <Input {...form.register("firstName")} />
      </FormField>
      <FormField
        label="Nom"
        htmlFor="p-lastName"
        required
        error={form.formState.errors.lastName?.message}
      >
        <Input {...form.register("lastName")} />
      </FormField>
      <FormField
        label="Email"
        htmlFor="p-email"
        required
        error={form.formState.errors.email?.message}
        className="sm:col-span-2"
      >
        <Input type="email" {...form.register("email")} />
      </FormField>
      <FormField
        label="Commune"
        htmlFor="p-city"
        error={form.formState.errors.city?.message}
      >
        <Input {...form.register("city")} />
      </FormField>
      <FormField
        label="Téléphone"
        htmlFor="p-phone"
        error={form.formState.errors.phone?.message}
      >
        <Input {...form.register("phone")} />
      </FormField>
      <FormField
        label="Programme"
        htmlFor="p-programme"
        error={form.formState.errors.programmeId?.message}
        className="sm:col-span-3"
      >
        <Select {...form.register("programmeId")}>
          <option value="">— Non assigné —</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Source"
        htmlFor="p-source"
        error={form.formState.errors.source?.message}
        className="sm:col-span-3"
      >
        <Input
          placeholder="ex : Salon, recommandation"
          {...form.register("source")}
        />
      </FormField>
      <FormField
        label="Notes"
        htmlFor="p-notes"
        error={form.formState.errors.notes?.message}
        className="sm:col-span-6"
      >
        <Textarea rows={2} {...form.register("notes")} />
      </FormField>

      {globalError && (
        <div className="sm:col-span-6">
          <Alert variant="danger" role="alert">
            {globalError}
          </Alert>
        </div>
      )}
      {success && (
        <div className="sm:col-span-6">
          <Alert variant="success" role="status">
            Prospect ajouté.
          </Alert>
        </div>
      )}

      <div className="sm:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Ajout…" : "Ajouter le prospect"}
        </Button>
      </div>
    </form>
  );
}
