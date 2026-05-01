"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  flagMissingPieceAction,
  notaryUpdateStatusAction,
} from "@/lib/notary/actions";

export function NotaryStatusActions({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signOpen, setSignOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(status: "ACT_SIGNED" | "BLOCKED") {
    setError(null);
    startTransition(async () => {
      const result = await notaryUpdateStatusAction(dossierId, status);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSignOpen(false);
      setBlockOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button onClick={() => setSignOpen(true)} block disabled={pending}>
        Marquer l&apos;acte comme signé
      </Button>
      <Button
        variant="outline"
        onClick={() => setBlockOpen(true)}
        block
        disabled={pending}
      >
        Bloquer le dossier
      </Button>

      <ConfirmDialog
        open={signOpen}
        title="Confirmer la signature de l'acte ?"
        description="Cette action clôt le dossier et notifie le client + le collaborateur. Le lot passe en VENDU."
        confirmLabel="Confirmer la signature"
        pending={pending}
        onCancel={() => setSignOpen(false)}
        onConfirm={() => run("ACT_SIGNED")}
      />
      <ConfirmDialog
        open={blockOpen}
        title="Bloquer ce dossier ?"
        description="Le dossier passe en statut Bloqué. Ajoutez un commentaire au collaborateur via le signalement de pièce."
        confirmLabel="Bloquer"
        destructive
        pending={pending}
        onCancel={() => setBlockOpen(false)}
        onConfirm={() => run("BLOCKED")}
      />
    </div>
  );
}

export function FlagMissingPieceForm({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function submit() {
    if (label.trim().length < 2) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await flagMissingPieceAction({
        dossierId,
        label: label.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" role="status">
          Demande envoyée au collaborateur.
        </Alert>
      )}
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ex : justificatif de domicile original"
        aria-label="Pièce manquante à demander"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button onClick={submit} disabled={pending || label.trim().length < 2}>
        Signaler une pièce manquante
      </Button>
    </div>
  );
}
