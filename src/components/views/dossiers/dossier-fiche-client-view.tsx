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
 * Vue « fiche client d'un dossier » — implémentation unique partagée par
 * l'espace collaborateur et l'espace admin (T5/T15). Le contrôle d'accès est
 * fait par la route appelante.
 */
interface Props {
  dossierId: string;
  /** Racine « dossiers » de l'espace appelant, ex. « /admin/dossiers ». */
  basePath: string;
}

export async function DossierFicheClientView({
  dossierId: id,
  basePath,
}: Props) {
  const dossier = await prisma.dossier.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
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
  });
  if (!dossier) notFound();

  const address = decodeAddress(dossier.client?.addressEnc ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`${basePath}/${dossier.id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au dossier
        </Link>
        <h1 className="text-equatis-night-800 mt-2 text-2xl font-semibold tracking-tight">
          Fiche client
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dossier{" "}
          {dossier.client
            ? `${dossier.client.firstName} ${dossier.client.lastName}`
            : "sans client"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;acquéreur</CardTitle>
        </CardHeader>
        <CardContent>
          {dossier.client ? (
            <ClientProfileForm
              dossierId={dossier.id}
              email={dossier.client.email}
              initial={{
                firstName: dossier.client.firstName,
                lastName: dossier.client.lastName,
                phone: safeDecrypt(dossier.client.phoneEnc),
                birthName: dossier.client.clientProfile?.birthName ?? "",
                birthDate: toDateInput(
                  dossier.client.clientProfile?.birthDate ?? null,
                ),
                birthPlace: dossier.client.clientProfile?.birthPlace ?? "",
                profession: dossier.client.clientProfile?.profession ?? "",
                nationality: dossier.client.clientProfile?.nationality ?? "",
                addressLine: address?.line ?? "",
                postalCode: address?.postalCode ?? "",
                city: address?.city ?? "",
                country: address?.country ?? "",
                familyStatus: dossier.client.clientProfile?.familyStatus ?? "",
                marriageDate: toDateInput(
                  dossier.client.clientProfile?.marriageDate ?? null,
                ),
                marriagePlace:
                  dossier.client.clientProfile?.marriagePlace ?? "",
                marriageContract:
                  dossier.client.clientProfile?.marriageContract ?? "",
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Aucun client n&apos;est encore associé à ce dossier. Associez un
              client depuis la page du dossier pour renseigner sa fiche.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
