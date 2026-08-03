import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Th } from "@/components/ui/table";
import { toggleSortDirection, type LotSortDirection } from "@/lib/lot/sort";

/**
 * En-tête de colonne « référence de lot », cliquable pour inverser le sens du
 * tri naturel (T13). Le sens voyage dans l'URL (`?tri=asc|desc`), ce qui
 * conserve le tri au rechargement et le rend partageable.
 */
interface Props {
  direction: LotSortDirection;
  /** Libellé de la colonne, selon le tableau. */
  label?: string;
  /** Paramètres d'URL à préserver en changeant de sens. */
  preserve?: Record<string, string | undefined>;
}

export function LotReferenceHeader({
  direction,
  label = "Lot",
  preserve = {},
}: Props) {
  const next = toggleSortDirection(direction);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(preserve)) {
    if (value) params.set(key, value);
  }
  params.set("tri", next);

  const Icon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <Th className="whitespace-nowrap">
      <Link
        href={`?${params.toString()}`}
        aria-label={`Trier par référence de lot, ordre ${
          next === "asc" ? "croissant" : "décroissant"
        }`}
        className="hover:text-equatis-turquoise-700 inline-flex items-center gap-1"
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </Link>
    </Th>
  );
}
