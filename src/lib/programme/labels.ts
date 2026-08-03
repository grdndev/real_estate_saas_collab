import type { ProgrammeStatus } from "@/generated/prisma/enums";

type BadgeVariant = "neutral" | "info" | "warning" | "success" | "danger";

/** Statut d'un programme — libellé et badge, identiques dans tous les espaces. */
export const PROGRAMME_STATUS_BADGE: Record<
  ProgrammeStatus,
  { label: string; variant: BadgeVariant }
> = {
  DRAFT: { label: "Brouillon", variant: "neutral" },
  ACTIVE: { label: "Actif", variant: "success" },
  ARCHIVED: { label: "Archivé", variant: "warning" },
};
