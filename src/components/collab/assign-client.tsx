"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { assignClientAction } from "@/lib/dossier/actions";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  dossierId: string;
  pendingClients: ClientOption[];
}

export function AssignClientForm({ dossierId, pendingClients }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (pendingClients.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun client en attente d&apos;association. Le client doit
        s&apos;inscrire et confirmer son email.
      </p>
    );
  }

  function submit() {
    if (!clientId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignClientAction({ dossierId, clientId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        aria-label="Choisir un client à associer"
      >
        <option value="">Sélectionner un client…</option>
        {pendingClients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firstName} {c.lastName} ({c.email})
          </option>
        ))}
      </Select>
      <div className="flex justify-end">
        <Button disabled={!clientId || pending} onClick={submit}>
          {pending ? "Association…" : "Associer le client"}
        </Button>
      </div>
    </div>
  );
}
