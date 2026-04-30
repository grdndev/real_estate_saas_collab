import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DossierProgress,
  nextStageLabel,
} from "@/components/client-space/progress-bar";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mon dossier" };

const STATUS_BADGE = {
  NEW_LEAD: { label: "Nouveau lead", variant: "neutral" as const },
  RESERVATION_SENT: { label: "Réservation envoyée", variant: "info" as const },
  SIGNATURE_PENDING: {
    label: "Signature en attente",
    variant: "warning" as const,
  },
  SIGNED_AT_NOTARY: { label: "Chez le notaire", variant: "info" as const },
  LOAN_OFFER_RECEIVED: {
    label: "Offre de prêt reçue",
    variant: "info" as const,
  },
  ACT_SIGNED: { label: "Acte signé", variant: "success" as const },
  BLOCKED: { label: "Bloqué", variant: "danger" as const },
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default async function ClientDashboardPage() {
  const me = await requireRole(["CLIENT", "SUPER_ADMIN"]);

  const dossier = await prisma.dossier.findUnique({
    where: { clientId: me.id },
    include: {
      programme: { select: { name: true, reference: true, city: true } },
      lot: true,
      participants: {
        where: { role: "COLLABORATOR_PRIMARY" },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      documentRequests: {
        select: { id: true, label: true, fulfilled: true, required: true },
      },
    },
  });

  if (!dossier) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>En attente d&apos;association</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              Bonjour {me.name?.split(" ")[0] ?? ""}, votre compte est créé et
              votre adresse email est confirmée.
            </p>
            <p className="text-slate-600">
              Un collaborateur Équatis va prochainement vous associer à votre
              dossier d&apos;acquisition. Vous serez notifié(e) par email dès
              que votre dossier sera prêt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sb = STATUS_BADGE[dossier.status];
  const referent = dossier.participants[0]?.user;
  const totalRequests = dossier.documentRequests.length;
  const fulfilledRequests = dossier.documentRequests.filter(
    (r) => r.fulfilled,
  ).length;
  const missingRequired = dossier.documentRequests.filter(
    (r) => r.required && !r.fulfilled,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Bonjour {me.name?.split(" ")[0] ?? ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Suivi de votre acquisition immobilière.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mon programme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-equatis-night-800 text-lg font-semibold">
            {dossier.programme.name}
            {dossier.programme.city && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                · {dossier.programme.city}
              </span>
            )}
          </p>
          {dossier.lot && (
            <div className="text-slate-700">
              <p>
                Lot <span className="font-mono">{dossier.lot.reference}</span> ·{" "}
                {dossier.lot.surface.toString()} m² · {dossier.lot.type}
              </p>
              <p className="text-slate-600">
                Prix TTC :{" "}
                <strong>{eur.format(Number(dossier.lot.priceTTC))}</strong>
              </p>
            </div>
          )}
          <p className="pt-2">
            <Badge variant={sb.variant}>{sb.label}</Badge>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avancement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DossierProgress current={dossier.status} />
          <p className="text-equatis-night-800 text-sm">
            <strong>Prochaine étape :</strong> {nextStageLabel(dossier.status)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>{fulfilledRequests}</strong> sur{" "}
              <strong>{totalRequests}</strong> pièces déposées.
            </p>
            {missingRequired > 0 && (
              <Alert variant="warning">
                {missingRequired} pièce{missingRequired > 1 ? "s" : ""}{" "}
                obligatoire{missingRequired > 1 ? "s" : ""} en attente.
              </Alert>
            )}
            <Link href="/client/documents">
              <Button variant="outline">Voir mes documents</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mon collaborateur référent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {referent ? (
              <>
                <p className="font-medium">
                  {referent.firstName} {referent.lastName}
                </p>
                <p className="text-slate-600">
                  <a
                    className="text-sky-700 hover:underline"
                    href={`mailto:${referent.email}`}
                  >
                    {referent.email}
                  </a>
                </p>
                <Link href="/client/messagerie" className="inline-block pt-1">
                  <Button variant="outline">Envoyer un message</Button>
                </Link>
              </>
            ) : (
              <p className="text-slate-500">Aucun référent assigné.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
