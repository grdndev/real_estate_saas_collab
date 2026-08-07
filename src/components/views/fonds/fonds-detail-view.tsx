import { AttachNotaryForm } from "@/components/collab/attach-notary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LotFondsForm } from "@/components/collaborateur/fonds/lot-fonds-form";
import { ClientContactCard } from "@/components/collaborateur/fonds/client-contact-card";
import { decodeAddress, decodePhone, decodeText } from "@/lib/profile";
import type { LotFondsDetail } from "@/lib/fonds/access";

/**
 * Vue « détail fonds d'un lot » — implémentation unique partagée par les
 * espaces admin et collaborateur (T15).
 */
interface Props {
  lot: LotFondsDetail;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  lotBasePath: string;
  /** Notaires actifs, pour le rattachement depuis le lot (T4). */
  notaries: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
  programmeAppelTypes: {
    id: string;
    numero: number;
    label: string;
    pourcentage: number;
    datePrevue: string;
    debloque: boolean;
  }[];
}

export function FondsDetailView({
  lot,
  lotBasePath,
  notaries,
  programmeAppelTypes,
}: Props) {
  const actSignedDate =
    lot.dossier?.timelineEvents?.[0]?.occurredAt?.toISOString() ?? null;
  const client = lot.dossier?.client ?? null;
  const clientName = client
    ? `${client.firstName} ${client.lastName}`.trim()
    : null;

  const clientContact = client
    ? {
        email: client.email,
        additionalEmails: decodeText(client.additionalEmailsEnc),
        phone: decodePhone(client.phoneEnc),
        address: decodeAddress(client.addressEnc),
      }
    : null;

  const fondsSuivi = lot.fondsSuivi
    ? {
        commission:
          lot.fondsSuivi.commission != null
            ? Number(lot.fondsSuivi.commission)
            : null,
        fraisMainLevee:
          lot.fondsSuivi.fraisMainLevee != null
            ? Number(lot.fondsSuivi.fraisMainLevee)
            : null,
        rbstEdd:
          lot.fondsSuivi.rbstEdd != null
            ? Number(lot.fondsSuivi.rbstEdd)
            : null,
        soldeVendeur:
          lot.fondsSuivi.soldeVendeur != null
            ? Number(lot.fondsSuivi.soldeVendeur)
            : null,
        fondsAppeles: lot.fondsSuivi.fondsAppeles.map((fa) => ({
          appelFondsId: fa.appelFondsId,
          montant: Number(fa.montant),
          dateEnvoiLr: fa.dateEnvoiLr?.toISOString() ?? null,
          dateReceptionVirement:
            fa.dateReceptionVirement?.toISOString() ?? null,
        })),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Lot {lot.reference}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{lot.programme.name}</p>
      </div>

      <ClientContactCard
        lotId={lot.id}
        dossierId={lot.dossier?.id ?? null}
        clientName={clientName}
        contact={clientContact}
        convertedProspect={Boolean(lot.dossier?.prospect)}
        pendingSignature={(lot.dossier?.signatures.length ?? 0) > 0}
        lotBasePath={lotBasePath}
      />

      <Card>
        <CardHeader>
          <CardTitle>Notaire du lot</CardTitle>
        </CardHeader>
        <CardContent>
          {lot.dossier ? (
            /* Rattachement simple, sans transmission de documents (T4). */
            <AttachNotaryForm
              dossierId={lot.dossier.id}
              notaries={notaries}
              currentNotaryId={lot.dossier.notaryId}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Ce lot n&apos;a pas encore de dossier : créez-le depuis la fiche
              du programme pour pouvoir lui rattacher un notaire.
            </p>
          )}
        </CardContent>
      </Card>

      <LotFondsForm
        lotId={lot.id}
        programmeName={lot.programme.name}
        clientName={clientName}
        priceTTC={Number(lot.priceTTC)}
        actSignedDate={actSignedDate}
        notes={lot.notes ?? null}
        hasClient={Boolean(client)}
        hasClientAddress={Boolean(clientContact?.address)}
        fondsSuivi={fondsSuivi}
        programmeAppelTypes={programmeAppelTypes}
      />
    </div>
  );
}
