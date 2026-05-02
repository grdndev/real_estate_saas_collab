"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requestSignatureAction } from "@/lib/yousign/actions";

interface SignatureRow {
  id: string;
  status: string;
  signerEmail: string;
  signedAt: Date | null;
  createdAt: Date;
}

interface Props {
  dossierId: string;
  reference: string;
  defaultSigner: { firstName: string; lastName: string; email: string } | null;
  signatures: SignatureRow[];
  yousignReady: boolean;
}

const STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: "info" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  CREATED: { label: "Créée", variant: "neutral" },
  SENT: { label: "Envoyée", variant: "info" },
  OPENED: { label: "Ouverte", variant: "info" },
  SIGNED: { label: "Signée", variant: "success" },
  REFUSED: { label: "Refusée", variant: "danger" },
  EXPIRED: { label: "Expirée", variant: "warning" },
  ERROR: { label: "Erreur", variant: "danger" },
};

export function RequestSignatureBlock({
  dossierId,
  reference,
  defaultSigner,
  signatures,
  yousignReady,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(defaultSigner?.firstName ?? "");
  const [lastName, setLastName] = useState(defaultSigner?.lastName ?? "");
  const [email, setEmail] = useState(defaultSigner?.email ?? "");

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestSignatureAction({
        dossierId,
        documentId: null,
        signerEmail: email,
        signerFirstName: firstName,
        signerLastName: lastName,
        procedureName: `Équatis - ${reference}`,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirm(false);
        return;
      }
      setConfirm(false);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {!yousignReady && (
        <Alert variant="warning">
          Yousign n&apos;est pas configuré (variables YOUSIGN_API_KEY).
        </Alert>
      )}
      {signatures.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {signatures.map((s) => {
            const sb = STATUS_BADGE[s.status] ?? {
              label: s.status,
              variant: "neutral" as const,
            };
            return (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-mono text-xs">{s.signerEmail}</p>
                  <p className="text-xs text-slate-500">
                    {s.signedAt
                      ? `Signée le ${s.signedAt.toLocaleDateString("fr-FR")}`
                      : `Demandée le ${s.createdAt.toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <Badge variant={sb.variant}>{sb.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}

      {!open ? (
        <Button
          disabled={!yousignReady}
          onClick={() => setOpen(true)}
          variant="outline"
        >
          Demander une signature
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Prénom" htmlFor="sig-fn" required>
              <Input
                id="sig-fn"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </FormField>
            <FormField label="Nom" htmlFor="sig-ln" required>
              <Input
                id="sig-ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Email du signataire" htmlFor="sig-email" required>
            <Input
              id="sig-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => setConfirm(true)}
              disabled={
                pending ||
                firstName.trim().length < 2 ||
                lastName.trim().length < 2 ||
                !email.includes("@")
              }
            >
              Envoyer la demande
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Lancer la procédure de signature ?"
        description={`Yousign enverra un email à ${email} avec un lien de signature électronique simple. Cette action est journalisée.`}
        confirmLabel="Confirmer l'envoi"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
