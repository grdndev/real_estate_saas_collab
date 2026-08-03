import type { UserStatus } from "@/generated/prisma/enums";

type BadgeVariant = "neutral" | "info" | "warning" | "success" | "danger";

/**
 * Statut d'un compte utilisateur — libellé et badge, identiques dans tous les
 * espaces (implémentation unique : admin/utilisateurs, journal d'activité,
 * fiches client…).
 */
export const USER_STATUS_BADGE: Record<
  UserStatus,
  { label: string; variant: BadgeVariant }
> = {
  ACTIVE: { label: "Actif", variant: "success" },
  PENDING_EMAIL: { label: "Email non vérifié", variant: "warning" },
  PENDING_ASSOCIATION: { label: "Attente association", variant: "info" },
  SUSPENDED: { label: "Désactivé", variant: "danger" },
  DELETION_REQUESTED: { label: "Suppression demandée", variant: "danger" },
  NO_ACCOUNT: { label: "Sans compte", variant: "neutral" },
};
