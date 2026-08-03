"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { UnassignClientButton } from "@/components/collab/unassign-client";
import { updateFondsClientContactAction } from "@/lib/collaborateur/fonds-actions";

export interface ClientContactData {
  email: string;
  additionalEmails: string;
  phone: string;
  address: {
    line: string;
    postalCode: string;
    city: string;
    country: string;
  } | null;
}

interface Props {
  lotId: string;
  dossierId: string | null;
  clientName: string | null;
  contact: ClientContactData | null;
  convertedProspect?: boolean;
  pendingSignature?: boolean;
  /** Racine « dossiers » de l'espace appelant, ex. « /admin/dossiers ». */
  dossierBasePath: string;
}

export function ClientContactCard({
  lotId,
  dossierId,
  clientName,
  contact,
  convertedProspect = false,
  pendingSignature = false,
  dossierBasePath,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [fields, setFields] = useState({
    email: contact?.email ?? "",
    additionalEmails: contact?.additionalEmails ?? "",
    phone: contact?.phone ?? "",
    line: contact?.address?.line ?? "",
    postalCode: contact?.address?.postalCode ?? "",
    city: contact?.address?.city ?? "",
    country: contact?.address?.country ?? "",
  });

  function setField(key: keyof typeof fields, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
  }

  function handleCancel() {
    setFields({
      email: contact?.email ?? "",
      additionalEmails: contact?.additionalEmails ?? "",
      phone: contact?.phone ?? "",
      line: contact?.address?.line ?? "",
      postalCode: contact?.address?.postalCode ?? "",
      city: contact?.address?.city ?? "",
      country: contact?.address?.country ?? "",
    });
    setError(null);
    setEditing(false);
  }

  function handleSubmit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateFondsClientContactAction({
        lotId,
        email: fields.email.trim(),
        additionalEmails: fields.additionalEmails || null,
        phone: fields.phone || null,
        address: {
          line: fields.line,
          postalCode: fields.postalCode,
          city: fields.city,
          country: fields.country,
        },
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
        setEditing(false);
        router.refresh();
      }
    });
  }

  const addressText = contact?.address
    ? [
        contact.address.line,
        [contact.address.postalCode, contact.address.city]
          .filter(Boolean)
          .join(" "),
        contact.address.country,
      ]
        .filter((s) => s && s.trim() !== "")
        .join(", ")
    : "";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Client</CardTitle>
        {dossierId && (
          <Link
            href={`${dossierBasePath}/${dossierId}`}
            className="text-equatis-turquoise-700 text-sm hover:underline"
          >
            Voir le dossier →
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {!dossierId ? (
          <p className="text-sm text-slate-500">
            Aucun dossier associé à ce lot.
          </p>
        ) : !contact ? (
          <p className="text-sm text-slate-500">
            Aucun client associé à ce dossier. Associez un client depuis la page
            du dossier.
          </p>
        ) : !editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Nom</p>
                <p className="text-sm font-medium">{clientName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium break-all">
                  {contact.email || "—"}
                </p>
                {contact.additionalEmails && (
                  <p className="mt-0.5 text-xs break-all text-slate-500">
                    {contact.additionalEmails}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p className="text-sm font-medium">{contact.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Adresse postale</p>
                <p className="text-sm font-medium">{addressText || "—"}</p>
              </div>
            </div>
            {saved && (
              <Alert variant="success">Coordonnées enregistrées.</Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                Modifier les coordonnées
              </Button>
              {dossierId && (
                <UnassignClientButton
                  dossierId={dossierId}
                  clientName={clientName ?? "ce client"}
                  convertedProspect={convertedProspect}
                  pendingSignature={pendingSignature}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Email" htmlFor="client-email" required>
                <Input
                  type="email"
                  value={fields.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </FormField>
              <FormField
                label="Emails supplémentaires"
                htmlFor="client-additional-emails"
                hint="Conjoint, etc. — séparés par des virgules."
              >
                <Input
                  value={fields.additionalEmails}
                  onChange={(e) => setField("additionalEmails", e.target.value)}
                />
              </FormField>
              <FormField label="Téléphone" htmlFor="client-phone">
                <Input
                  type="tel"
                  value={fields.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Adresse" htmlFor="client-address-line">
                <Input
                  value={fields.line}
                  onChange={(e) => setField("line", e.target.value)}
                />
              </FormField>
              <FormField label="Code postal" htmlFor="client-postal-code">
                <Input
                  value={fields.postalCode}
                  onChange={(e) => setField("postalCode", e.target.value)}
                />
              </FormField>
              <FormField label="Ville" htmlFor="client-city">
                <Input
                  value={fields.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </FormField>
              <FormField label="Pays" htmlFor="client-country">
                <Input
                  value={fields.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
              </FormField>
            </div>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={pending || !fields.email.trim()}
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
