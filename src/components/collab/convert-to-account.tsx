"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { convertToAccountClientAction } from "@/lib/client-account/actions";

/**
 * Conversion d'un « client associé » (sans compte) en client disposant d'un
 * accès à la plateforme (T7). Le dossier et son historique sont conservés :
 * seul le statut du compte change.
 */
interface Props {
  clientId: string;
  clientName: string;
  /** Email déjà renseigné, s'il ne s'agit pas d'une adresse technique. */
  currentEmail: string | null;
}

export function ConvertToAccountButton({
  clientId,
  clientName,
  currentEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await convertToAccountClientAction({ clientId, email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Créer un accès pour ce client
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        {clientName} recevra une invitation pour définir son mot de passe. Son
        dossier et tout son historique sont conservés.
      </p>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <FormField label="Email du client" htmlFor="convert-email" required>
        <Input
          id="convert-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </FormField>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !email}>
          {pending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
