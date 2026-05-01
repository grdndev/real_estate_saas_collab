"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { transmitToNotaryAction } from "@/lib/notary/actions";

interface NotaryOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Props {
  dossierId: string;
  notaries: NotaryOption[];
  currentNotaryId: string | null;
}

export function TransmitNotaryForm({
  dossierId,
  notaries,
  currentNotaryId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notaryId, setNotaryId] = useState(currentNotaryId ?? "");
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (notaries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun notaire actif. Demandez à l&apos;administrateur d&apos;en inviter
        un.
      </p>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await transmitToNotaryAction({
        dossierId,
        notaryId,
        comment: comment || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirm(false);
        return;
      }
      setConfirm(false);
      setComment("");
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
        value={notaryId}
        onChange={(e) => setNotaryId(e.target.value)}
        aria-label="Choisir un notaire"
      >
        <option value="">Sélectionner un notaire…</option>
        {notaries.map((n) => (
          <option key={n.id} value={n.id}>
            {n.firstName} {n.lastName} ({n.email})
          </option>
        ))}
      </Select>
      <Textarea
        rows={2}
        placeholder="Note pour le notaire (optionnel)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          onClick={() => setConfirm(true)}
          disabled={!notaryId || pending || notaryId === currentNotaryId}
        >
          {currentNotaryId ? "Changer de notaire" : "Transmettre au notaire"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Transmettre ce dossier au notaire ?"
        description="Le notaire sélectionné aura accès au dossier en lecture, pourra signaler des pièces manquantes et confirmer la signature de l'acte. Le statut passe à « Chez le notaire »."
        confirmLabel="Transmettre"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
