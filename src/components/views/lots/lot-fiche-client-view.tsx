import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientProfileForm } from "@/components/collab/client-profile-form";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { decodeAddress } from "@/lib/profile";

function safeDecrypt(value: string | null): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return "";
  }
}

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

/**
 * Vue « fiche client d'un lot » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin (T5/T15). Le contrôle d'accès est fait par la
 * route appelante.
 *
 * La fiche est celle du client du dossier ACTIF du lot.
 */
interface Props {
  lotId: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

export async function LotFicheClientView({ lotId, basePath }: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: {
      reference: true,
      dossier: {
        select: {
          id: true,
          client: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneEnc: true,
              addressEnc: true,
              clientProfile: true,
            },
          },
        },
      },
    },
  });
  if (!lot) notFound();

  const dossier = lot.dossier;
  const client = dossier?.client ?? null;
  const address = decodeAddress(client?.addressEnc ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`${basePath}/${lotId}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au lot
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Fiche client
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Lot {lot.reference} —{" "}
          {client ? `${client.firstName} ${client.lastName}` : "aucun client"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;acquéreur</CardTitle>
        </CardHeader>
        <CardContent>
          {dossier && client ? (
            <ClientProfileForm
              dossierId={dossier.id}
              email={client.email}
              initial={{
                firstName: client.firstName,
                lastName: client.lastName,
                phone: safeDecrypt(client.phoneEnc),
                birthName: client.clientProfile?.birthName ?? "",
                birthDate: toDateInput(client.clientProfile?.birthDate ?? null),
                birthPlace: client.clientProfile?.birthPlace ?? "",
                profession: client.clientProfile?.profession ?? "",
                nationality: client.clientProfile?.nationality ?? "",
                addressLine: address?.line ?? "",
                postalCode: address?.postalCode ?? "",
                city: address?.city ?? "",
                country: address?.country ?? "",
                familyStatus: client.clientProfile?.familyStatus ?? "",
                marriageDate: toDateInput(
                  client.clientProfile?.marriageDate ?? null,
                ),
                marriagePlace: client.clientProfile?.marriagePlace ?? "",
                marriageContract: client.clientProfile?.marriageContract ?? "",
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Aucun client n&apos;est associé à ce lot. Associez un client
              depuis la fiche du lot pour renseigner ses informations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
