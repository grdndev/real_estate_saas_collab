import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { decodeAddress, decodePhone, decodeText } from "@/lib/profile";
import { LotFondsForm } from "@/components/collaborateur/fonds/lot-fonds-form";
import { ClientContactCard } from "@/components/collaborateur/fonds/client-contact-card";

interface PageProps {
  params: Promise<{ lotId: string }>;
}

export const metadata: Metadata = { title: "Détail fonds · Admin" };

export default async function AdminLotFondsDetailPage({ params }: PageProps) {
  await requireRole("SUPER_ADMIN");
  const { lotId } = await params;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      programme: { select: { name: true } },
      dossier: {
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneEnc: true,
              addressEnc: true,
              additionalEmailsEnc: true,
            },
          },
          timelineEvents: {
            where: { kind: "ACT_SIGNED" },
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { occurredAt: true },
          },
        },
      },
      fondsSuivi: {
        include: { appelsFonds: { orderBy: { numero: "asc" } } },
      },
    },
  });

  if (!lot) notFound();

  const programmeAppelTypes = await prisma.appelFonds.findMany({
    where: { lotFonds: { programmeId: lot.programmeId } },
    orderBy: { numero: "asc" },
    distinct: ["numero"],
    select: { numero: true, label: true, pourcentage: true, datePrevue: true },
  });

  const now = new Date();

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
        appelsFonds: lot.fondsSuivi.appelsFonds.map((a) => ({
          numero: a.numero,
          label: a.label,
          datePrevue: a.datePrevue.toISOString(),
          pourcentage: Number(a.pourcentage),
          montant: Number(a.montant),
          dateEnvoiLr: a.dateEnvoiLr?.toISOString() ?? null,
          dateReceptionVirement: a.dateReceptionVirement?.toISOString() ?? null,
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
      />

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
        programmeAppelTypes={programmeAppelTypes.map((a) => ({
          numero: a.numero,
          label: a.label,
          pourcentage: Number(a.pourcentage),
          datePrevue: a.datePrevue.toISOString(),
          debloque: a.datePrevue <= now,
        }))}
      />
    </div>
  );
}
