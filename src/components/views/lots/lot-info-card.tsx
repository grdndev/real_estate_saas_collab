import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lot } from "@/generated/prisma/client";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const money = (v: Lot["priceNetVendeur"]) =>
  v != null ? eur.format(Number(v)) : "—";

/**
 * Caractéristiques du lot — données purement immobilières, indépendantes du
 * dossier : elles s'affichent que le lot ait un client associé ou non.
 */
export function LotInfoCard({ lot }: { lot: Lot }) {
  const totalSurface = Number(lot.surface) + Number(lot.annexSurface ?? 0);
  const rows: [string, string][] = [
    ["Localisation", lot.building ?? "—"],
    ["Étage", lot.floor != null ? String(lot.floor) : "—"],
    ["Type", lot.type],
    ["Surface habitable", `${lot.surface} m²`],
    [
      "Surface annexes",
      lot.annexSurface != null ? `${lot.annexSurface} m²` : "—",
    ],
    ["Total (habitable + annexe)", `${totalSurface} m²`],
    ["Jardin", lot.garden != null ? `${lot.garden} m²` : "—"],
    ["Prix FAI", eur.format(Number(lot.priceTTC))],
    ["Prix net vendeur", money(lot.priceNetVendeur)],
    ["NV avec place parking", money(lot.priceNetVendeurWithParking)],
    ["Commission agence", money(lot.commissionAgence)],
    ["CA pour place parking", money(lot.commissionAgenceParking)],
    ["Prix à la location", money(lot.priceLocation)],
    ["Crédit d'impôt 35%", money(lot.creditImpot35)],
    ["Prix de revient (avec CRD imp.)", money(lot.priceRevientCrdImp)],
    [
      "Parking supplémentaire",
      lot.additionalParking == null
        ? "—"
        : lot.additionalParking
          ? "Oui"
          : "Non",
    ],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lot {lot.reference}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right text-slate-700">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
