"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inviteUserAction } from "@/lib/admin/actions";
import { inviteUserSchema, type InviteUserInput } from "@/lib/admin/schemas";

export function InviteUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "COLLABORATOR",
    },
  });

  function onSubmit(values: InviteUserInput) {
    setGlobalError(null);
    startTransition(async () => {
      const result = await inviteUserAction(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            const first = messages?.[0];
            if (first) {
              form.setError(field as keyof InviteUserInput, { message: first });
            }
          }
        }
        setGlobalError(result.error);
        return;
      }
      router.replace("/admin/utilisateurs");
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
        label="Adresse email"
        htmlFor="email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input type="email" {...form.register("email")} />
      </FormField>
      <FormField
        label="Rôle"
        htmlFor="role"
        required
        hint="Le compte sera créé immédiatement et un email d'invitation sera envoyé pour définir le mot de passe."
        error={form.formState.errors.role?.message}
      >
        <Select {...form.register("role")}>
          <option value="COLLABORATOR">Collaborateur</option>
          <option value="PROMOTER">Promoteur</option>
          <option value="NOTARY">Notaire</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </Select>
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
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
      </div>
    </form>
  );
}
