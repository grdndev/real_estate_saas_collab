"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Bell } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { relaunchNotaryAction } from "@/lib/notary/actions";

interface Props {
  dossierId: string;
  notaryName: string;
  daysSinceTransmission: number;
}

export function RelaunchNotaryButton({
  dossierId,
  notaryName,
  daysSinceTransmission,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await relaunchNotaryAction({
        dossierId,
        comment: comment.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirm(false);
        return;
      }
      setConfirm(false);
      setOpen(false);
      setComment("");
      setSuccess(true);
      router.refresh();
      // Auto-hide success after 4s — fonction pure (pas dans le rendu)
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <div className="space-y-2">
      {success && (
        <Alert variant="success" role="status">
          Email de relance envoyé à {notaryName}.
        </Alert>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {!open ? (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full"
        >
          <Mail className="size-4" aria-hidden />
          Relancer le notaire
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <p className="text-xs text-slate-600">
            Envoyer un email de relance à <strong>{notaryName}</strong>{" "}
            (transmis depuis{" "}
            {daysSinceTransmission <= 1
              ? "moins de 24h"
              : `${daysSinceTransmission} jours`}
            ).
          </p>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Message complémentaire (optionnel) — ex : « Merci de prioriser ce dossier, signature client prévue vendredi »"
            aria-label="Message optionnel au notaire"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setComment("");
              }}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={pending}
            >
              <Bell className="size-4" aria-hidden />
              Envoyer la relance
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Limite anti-spam : 1 relance maximum toutes les 12h.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Relancer ${notaryName} par email ?`}
        description={
          <>
            <p>
              Un email de relance + une notification in-app seront envoyés
              immédiatement au notaire avec le lien direct vers le dossier.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Cette action est enregistrée dans le journal d&apos;audit et
              ajoutée à la timeline du dossier.
            </p>
          </>
        }
        confirmLabel="Envoyer la relance"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
