import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LotFondsForm } from "@/components/collaborateur/fonds/lot-fonds-form";

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
      programme: { select: { name: true, reference: true } },
      dossier: {
        include: {
          client: { select: { firstName: true, lastName: true } },
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

  const actSignedDate =
    lot.dossier?.timelineEvents?.[0]?.occurredAt?.toISOString() ?? null;
  const clientName = lot.dossier?.client
    ? `${lot.dossier.client.firstName} ${lot.dossier.client.lastName}`.trim()
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
        dateEnvoiLr: lot.fondsSuivi.dateEnvoiLr?.toISOString() ?? null,
        dateReceptionLr: lot.fondsSuivi.dateReceptionLr?.toISOString() ?? null,
        dateReceptionVirement:
          lot.fondsSuivi.dateReceptionVirement?.toISOString() ?? null,
        appelsFonds: lot.fondsSuivi.appelsFonds.map((a) => ({
          numero: a.numero,
          label: a.label,
          datePrevue: a.datePrevue,
          pourcentage: Number(a.pourcentage),
          montant: Number(a.montant),
        })),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-equatis-night-800 text-2xl font-semibold tracking-tight">
          Lot {lot.reference}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {lot.programme.name} — {lot.programme.reference}
        </p>
      </div>

      <LotFondsForm
        lotId={lot.id}
        programmeName={lot.programme.name}
        programmeReference={lot.programme.reference}
        clientName={clientName}
        priceTTC={Number(lot.priceTTC)}
        actSignedDate={actSignedDate}
        notes={lot.notes ?? null}
        fondsSuivi={fondsSuivi}
        programmeAppelTypes={programmeAppelTypes.map((a) => ({
          numero: a.numero,
          label: a.label,
          pourcentage: Number(a.pourcentage),
          datePrevue: a.datePrevue ?? null,
        }))}
      />
    </div>
  );
}
