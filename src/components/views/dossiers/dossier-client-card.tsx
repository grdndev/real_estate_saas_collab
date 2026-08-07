import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignClientForm } from "@/components/collab/assign-client";
import { ConvertToAccountButton } from "@/components/collab/convert-to-account";
import { RelaunchClientButton } from "@/components/collab/relaunch-client-button";
import { UnassignClientButton } from "@/components/collab/unassign-client";
import { prisma } from "@/lib/prisma";
import { loadAssignableClients } from "@/lib/lot/list-access";
import { displayableEmail } from "@/lib/user/no-account";

/**
 * Carte « client » d'un lot : association, dissociation et raccourcis vers la
 * fiche client.
 *
 * `dossierId` à `null` = lot libre : la carte propose alors d'associer un
 * client, ce qui créera (ou réactivera) le dossier du couple (lot, client).
 */
interface Props {
  lotId: string;
  dossierId: string | null;
  /** Chemin de la fiche lot, ex. « /admin/lots/clx… ». */
  lotPath: string;
}

export async function DossierClientCard({ lotId, dossierId, lotPath }: Props) {
  if (!dossierId) {
    const pendingClients = await loadAssignableClients();
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Ce lot est libre. Associez un client pour ouvrir son dossier.
          </p>
          <AssignClientForm lotId={lotId} pendingClients={pendingClients} />
        </CardContent>
      </Card>
    );
  }

  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
      prospect: { select: { id: true } },
      signatures: { select: { status: true } },
    },
  });

  const client = dossier.client;
  const clientName = `${client.firstName} ${client.lastName}`;
  const clientHasNoAccount = client.status === "NO_ACCOUNT";
  const clientEmail = displayableEmail(client.email);
  const hasPendingSignature = dossier.signatures.some((s) =>
    ["CREATED", "SENT", "OPENED"].includes(s.status),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {clientName}
            {clientHasNoAccount && <Badge variant="neutral">Sans compte</Badge>}
          </p>
          <p className="text-xs text-slate-500">
            {clientEmail ?? "Aucune adresse email renseignée"}
          </p>
          {clientHasNoAccount && (
            <p className="text-xs text-slate-500">
              Client associé : pas d&apos;accès à la plateforme, ni invitation,
              ni email de relance, ni messagerie.
            </p>
          )}
        </div>

        {!clientHasNoAccount && (
          <div className="border-t border-slate-100 pt-4">
            <RelaunchClientButton
              dossierId={dossier.id}
              clientName={clientName}
            />
          </div>
        )}
        {clientHasNoAccount && (
          <div className="border-t border-slate-100 pt-4">
            <ConvertToAccountButton
              clientId={client.id}
              clientName={clientName}
              currentEmail={clientEmail}
            />
          </div>
        )}
        <div className="border-t border-slate-100 pt-4">
          <Link
            href={`${lotPath}/fiche-client`}
            className="text-equatis-turquoise-700 text-sm font-medium hover:underline"
          >
            → Fiche client complète
          </Link>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <UnassignClientButton
            lotId={lotId}
            clientName={clientName}
            convertedProspect={Boolean(dossier.prospect)}
            pendingSignature={hasPendingSignature}
          />
        </div>
      </CardContent>
    </Card>
  );
}
