import type { LotStatus } from "@/generated/prisma/enums";

type BadgeVariant = "neutral" | "info" | "warning" | "success" | "danger";

/** Statut commercial d'un lot — libellé et badge, identiques dans tous les espaces. */
export const LOT_STATUS_BADGE: Record<
  LotStatus,
  { label: string; variant: BadgeVariant }
> = {
  AVAILABLE: { label: "Disponible", variant: "success" },
  OPTIONED: { label: "Optionné", variant: "warning" },
  RESERVED: { label: "Réservé", variant: "warning" },
  SOLD: { label: "Vendu", variant: "info" },
  WITHDRAWN: { label: "Retiré", variant: "neutral" },
};
