"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Bell } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { relaunchClientAction } from "@/lib/dossier/actions";

interface Props {
  dossierId: string;
  clientName: string;
}

export function RelaunchClientButton({ dossierId, clientName }: Props) {
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
      const result = await relaunchClientAction({
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
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <div className="space-y-2">
      {success && (
        <Alert variant="success" role="status">
          Email de relance envoyé à {clientName}.
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
          Relancer le client
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <p className="text-xs text-slate-600">
            Envoyer un email de relance à <strong>{clientName}</strong>.
          </p>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Message complémentaire (optionnel) — ex : « Merci de déposer votre justificatif de domicile pour avancer le dossier »"
            aria-label="Message optionnel au client"
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
            Limite anti-spam : 1 relance par 12h.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Relancer ${clientName} par email ?`}
        description={
          <>
            <p>
              Un email Brevo + une notification in-app seront envoyés
              immédiatement au client avec le lien vers son espace.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Cette action est tracée dans le journal d&apos;audit et ajoutée à
              la timeline du dossier.
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
