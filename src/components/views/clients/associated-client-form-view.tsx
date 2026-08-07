import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssociatedClientForm } from "@/components/collab/associated-client-form";
import { DeleteAssociatedClientButton } from "@/components/collab/delete-associated-client";
import { loadAssociatedClient } from "@/lib/client-account/list";
import { prisma } from "@/lib/prisma";

/**
 * Création / modification d'une fiche de client sans compte (T7) —
 * implémentation unique partagée par les espaces collaborateur et admin. Le
 * contrôle d'accès est fait par la route appelante.
 */
interface Props {
  /** Racine de la section, ex. « /admin/clients/associes ». */
  basePath: string;
  /** Absent = création. */
  clientId?: string;
}

export async function AssociatedClientFormView({ basePath, clientId }: Props) {
  const client = clientId ? await loadAssociatedClient(clientId) : null;
  if (clientId && !client) notFound();

  const dossierCounts =
    client &&
    (await prisma.dossier.groupBy({
      by: ["archivedAt"],
      where: { clientId: client.id },
      _count: { _all: true },
    }));
  const activeDossiers =
    dossierCounts
      ?.filter((g) => g.archivedAt === null)
      .reduce((n, g) => n + g._count._all, 0) ?? 0;
  const archivedDossiers =
    dossierCounts
      ?.filter((g) => g.archivedAt !== null)
      .reduce((n, g) => n + g._count._all, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={basePath}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour aux clients sans compte
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          {client
            ? `${client.firstName} ${client.lastName}`
            : "Nouvelle fiche client"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {client
            ? "Client géré en interne : aucune de ces informations ne déclenche d'envoi."
            : "Fiche d'un client géré en interne, sans accès à la plateforme. Vous pourrez ensuite l'associer à un lot depuis la fiche du lot."}
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <AssociatedClientForm
            basePath={basePath}
            clientId={client?.id}
            initial={
              client
                ? {
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    addressLine: client.addressLine,
                    postalCode: client.postalCode,
                    city: client.city,
                    country: client.country,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      {client && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Supprimer cette fiche</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {activeDossiers > 0
                ? "Ce client suit un dossier actif : dissociez-le de son lot avant de supprimer sa fiche."
                : archivedDossiers > 0
                  ? "La fiche sera retirée des listes ; ses dossiers archivés restent conservés."
                  : "Cette fiche n'a jamais porté de dossier : elle sera supprimée définitivement."}
            </p>
            <DeleteAssociatedClientButton
              clientId={client.id}
              clientName={`${client.firstName} ${client.lastName}`}
              activeDossiers={activeDossiers}
              archivedDossiers={archivedDossiers}
              redirectTo={basePath}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
