"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestSignatureAction } from "@/lib/yousign/actions";

interface SignatureRow {
  id: string;
  status: string;
  signerEmail: string;
  signedAt: Date | null;
  createdAt: Date;
}

export interface SignatureRecipient {
  role: "client" | "notary";
  label: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SignatureDocument {
  id: string;
  fileName: string;
}

interface Props {
  dossierId: string;
  reference: string;
  recipients: SignatureRecipient[];
  documents: SignatureDocument[];
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
  recipients,
  documents,
  signatures,
  yousignReady,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipientKey, setRecipientKey] = useState(recipients[0]?.role ?? "");
  const [documentId, setDocumentId] = useState("");
  const [firstName, setFirstName] = useState(recipients[0]?.firstName ?? "");
  const [lastName, setLastName] = useState(recipients[0]?.lastName ?? "");
  const [email, setEmail] = useState(recipients[0]?.email ?? "");

  function onRecipientChange(role: string) {
    setRecipientKey(role);
    const r = recipients.find((x) => x.role === role);
    if (r) {
      setFirstName(r.firstName);
      setLastName(r.lastName);
      setEmail(r.email);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestSignatureAction({
        dossierId,
        documentId: documentId || null,
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
          Yousign n&apos;est pas configuré (variable YOUSIGN_API_KEY).
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
                  <p
                    className="text-xs text-slate-500"
                    suppressHydrationWarning
                  >
                    {s.signedAt
                      ? `Signée le ${s.signedAt.toLocaleDateString("fr-FR")}`
                      : `Envoyée le ${s.createdAt.toLocaleDateString("fr-FR")}`}
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
          Envoyer un document pour signature
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          <FormField label="Document à envoyer" htmlFor="sig-doc">
            <Select
              id="sig-doc"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            >
              <option value="">— Générer un document type Équatis —</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Destinataire" htmlFor="sig-recipient">
            <Select
              id="sig-recipient"
              value={recipientKey}
              onChange={(e) => onRecipientChange(e.target.value)}
            >
              {recipients.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
              <option value="">Autre destinataire…</option>
            </Select>
          </FormField>

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
              Envoyer pour signature
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Envoyer le document pour signature ?"
        description={`Yousign enverra un email à ${email} avec un lien de signature électronique. Le document signé reviendra automatiquement sur le dossier. Cette action est journalisée.`}
        confirmLabel="Confirmer l'envoi"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
