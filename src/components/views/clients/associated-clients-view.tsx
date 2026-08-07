import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { DeleteAssociatedClientButton } from "@/components/collab/delete-associated-client";
import { loadAssociatedClients } from "@/lib/client-account/list";

/**
 * Liste des « clients associés » sans compte (T7) — implémentation unique
 * partagée par l'espace collaborateur et l'espace admin, sur le modèle de
 * `LotFicheClientView`. Le contrôle d'accès est fait par la route appelante.
 */
interface Props {
  /** Racine de la section, ex. « /admin/clients/associes ». */
  basePath: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  lotsPath: string;
}

export async function AssociatedClientsView({ basePath, lotsPath }: Props) {
  const clients = await loadAssociatedClients();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
            Clients sans compte
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Fiches de clients gérés en interne : associables à un lot et suivies
            comme n&apos;importe quel dossier, mais sans accès à la plateforme —
            ni invitation, ni relance, ni messagerie.
          </p>
        </div>
        <Link href={`${basePath}/nouveau`}>
          <Button>Nouvelle fiche</Button>
        </Link>
      </div>

      <Card>
        {clients.length === 0 ? (
          <EmptyState
            title="Aucun client sans compte"
            description="Créez une fiche pour suivre un client dont le compte est géré en interne."
            action={
              <Link href={`${basePath}/nouveau`}>
                <Button>Nouvelle fiche</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Client</Th>
                <Th>Email</Th>
                <Th>Téléphone</Th>
                <Th>Dossier</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {clients.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium">
                    <Link
                      href={`${basePath}/${c.id}`}
                      className="hover:underline"
                    >
                      {c.lastName} {c.firstName}
                    </Link>
                  </Td>
                  <Td className="text-xs text-slate-500">{c.email ?? "—"}</Td>
                  <Td className="text-xs text-slate-500">{c.phone || "—"}</Td>
                  <Td className="text-xs">
                    {c.activeLot ? (
                      <Link
                        href={`${lotsPath}/${c.activeLot.id}`}
                        className="text-equatis-turquoise-700 hover:underline"
                      >
                        {c.activeLot.programmeName} — lot{" "}
                        {c.activeLot.reference}
                      </Link>
                    ) : c.archivedDossiers > 0 ? (
                      <Badge variant="neutral">
                        {c.archivedDossiers} archivé
                        {c.archivedDossiers > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">Aucun</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`${basePath}/${c.id}`}
                        className="text-equatis-turquoise-700 text-xs hover:underline"
                      >
                        Modifier
                      </Link>
                      <DeleteAssociatedClientButton
                        clientId={c.id}
                        clientName={`${c.firstName} ${c.lastName}`}
                        activeDossiers={c.activeDossiers}
                        archivedDossiers={c.archivedDossiers}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        <CardContent className="border-t border-slate-100 text-xs text-slate-500">
          Pour ouvrir un accès à l&apos;un de ces clients, utilisez « Créer un
          accès pour ce client » depuis la fiche de son lot : son dossier et
          tout son historique sont conservés.
        </CardContent>
      </Card>
    </div>
  );
}
