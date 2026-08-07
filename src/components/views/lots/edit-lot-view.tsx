import Link from "next/link";
import { notFound } from "next/navigation";

import { LotForm, type LotFormInitial } from "@/components/views/lots/lot-form";
import { prisma } from "@/lib/prisma";

/**
 * Vue « modifier un lot » — implémentation unique partagée par l'espace
 * collaborateur et l'espace admin.
 *
 * Le contrôle d'accès au lot est fait par la route appelante
 * (`findLotForUser`) ; la vue ne connaît pas le rôle de l'utilisateur.
 */
interface Props {
  lotId: string;
  /** Racine « lots » de l'espace appelant, ex. « /admin/lots ». */
  basePath: string;
}

/** Decimal Prisma → nombre sérialisable, en conservant le `null`. */
const num = (v: { toString(): string } | null) =>
  v != null ? Number(v) : null;

export async function EditLotView({ lotId, basePath }: Props) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { programme: { select: { name: true } } },
  });
  if (!lot) notFound();

  const initial: LotFormInitial = {
    id: lot.id,
    programmeId: lot.programmeId,
    reference: lot.reference,
    building: lot.building,
    floor: lot.floor,
    type: lot.type,
    notes: lot.notes,
    surface: Number(lot.surface),
    annexSurface: num(lot.annexSurface),
    suv: num(lot.suv),
    garden: num(lot.garden),
    priceHT: Number(lot.priceHT),
    vatRate: Number(lot.vatRate),
    priceTTC: Number(lot.priceTTC),
    priceNetVendeur: num(lot.priceNetVendeur),
    priceNetVendeurWithParking: num(lot.priceNetVendeurWithParking),
    commissionAgence: num(lot.commissionAgence),
    commissionAgenceParking: num(lot.commissionAgenceParking),
    priceLocation: num(lot.priceLocation),
    creditImpot35: num(lot.creditImpot35),
    priceRevientCrdImp: num(lot.priceRevientCrdImp),
    additionalParking: lot.additionalParking,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`${basePath}/${lot.id}`}
          className="text-equatis-turquoise-700 text-sm hover:underline"
        >
          ← Retour au lot
        </Link>
        <p className="text-equatis-night-700 mt-2 text-xs uppercase">
          {lot.programme.name}
        </p>
        <h1 className="text-equatis-night-800 mt-1 text-2xl font-semibold tracking-tight">
          Modifier le lot {lot.reference}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Le statut du lot n&apos;est pas modifiable ici : il suit
          l&apos;avancement du dossier.
        </p>
      </div>

      <LotForm lot={initial} basePath={basePath} />
    </div>
  );
}
