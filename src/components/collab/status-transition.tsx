"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { updateDossierStatusAction } from "@/lib/dossier/actions";
import type { DossierStatus } from "@/generated/prisma/enums";

const STATUS_OPTIONS: Array<{
  value: DossierStatus;
  label: string;
  destructive?: boolean;
}> = [
  { value: "NEW_LEAD", label: "Nouveau lead" },
  { value: "RESERVATION_SENT", label: "Réservation envoyée" },
  { value: "SIGNATURE_PENDING", label: "Signature en attente" },
  { value: "SIGNED_AT_NOTARY", label: "Chez le notaire" },
  { value: "LOAN_OFFER_RECEIVED", label: "Offre de prêt reçue" },
  { value: "ACT_SIGNED", label: "Acte signé", destructive: true },
  { value: "BLOCKED", label: "Bloqué" },
];

interface Props {
  dossierId: string;
  currentStatus: DossierStatus;
}

export function StatusTransition({ dossierId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [next, setNext] = useState<DossierStatus | "">("");
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOption = STATUS_OPTIONS.find((o) => o.value === next);
  const needsConfirm = targetOption?.destructive === true;

  function submit() {
    if (!next || next === currentStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDossierStatusAction({
        dossierId,
        status: next,
        comment: comment || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirm(false);
        return;
      }
      setConfirm(false);
      setNext("");
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
        value={next}
        onChange={(e) => setNext(e.target.value as DossierStatus | "")}
        aria-label="Choisir un nouveau statut"
      >
        <option value="">Changer de statut…</option>
        {STATUS_OPTIONS.filter((o) => o.value !== currentStatus).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
            {opt.destructive ? " (action irréversible)" : ""}
          </option>
        ))}
      </Select>
      <Textarea
        rows={2}
        placeholder="Commentaire (optionnel) ajouté à la timeline"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          disabled={!next || pending}
          onClick={() => (needsConfirm ? setConfirm(true) : submit())}
        >
          {pending ? "Mise à jour…" : "Appliquer"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Marquer ce dossier comme acte signé ?"
        description="Cette action clôt le dossier et passe le lot en VENDU. Elle est journalisée et difficilement réversible."
        destructive
        confirmLabel="Confirmer la signature de l'acte"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
