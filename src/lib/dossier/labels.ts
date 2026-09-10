import type { ContractStatus, DossierStatus } from "@/generated/prisma/enums";

type BadgeVariant = "neutral" | "info" | "warning" | "success" | "danger";

/** Workflow contractuel — ordre, libellés et badges (CDC évolution §4). */
export const CONTRACT_STATUS_ORDER: ContractStatus[] = [
  "AWAITING_SIGNATURE",
  "RESERVATION_SIGNED",
  "CONTRACT_SIGNED",
  "SENT_TO_NOTARY",
  "NOTARY_ACT_PENDING",
  "LOAN_OFFER_PENDING",
  "LOAN_OFFER_RECEIVED",
  "LOAN_OFFER_SENT_TO_NOTARY",
  "NOTARY_APPOINTMENT_SCHEDULED",
];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  AWAITING_SIGNATURE: "En attente de signature",
  RESERVATION_SIGNED: "Réservation signée",
  CONTRACT_SIGNED: "Contrat signé",
  SENT_TO_NOTARY: "Envoyé chez le notaire",
  NOTARY_ACT_PENDING: "Acte notarial en attente",
  LOAN_OFFER_PENDING: "Offre de prêt en attente",
  LOAN_OFFER_RECEIVED: "Offre de prêt reçue",
  LOAN_OFFER_SENT_TO_NOTARY:
    "Offre de prêt envoyée au notaire — en attente de RDV",
  NOTARY_APPOINTMENT_SCHEDULED: "RDV notaire planifié",
};

export const CONTRACT_STATUS_BADGE: Record<ContractStatus, BadgeVariant> = {
  AWAITING_SIGNATURE: "warning",
  RESERVATION_SIGNED: "info",
  CONTRACT_SIGNED: "info",
  SENT_TO_NOTARY: "info",
  NOTARY_ACT_PENDING: "warning",
  LOAN_OFFER_PENDING: "warning",
  LOAN_OFFER_RECEIVED: "info",
  LOAN_OFFER_SENT_TO_NOTARY: "warning",
  NOTARY_APPOINTMENT_SCHEDULED: "success",
};

/**
 * Cycle commercial du dossier — libellé et badge, identiques dans tous les
 * espaces. Source unique : toute vue affichant un `DossierStatus` lit ici.
 */
export const DOSSIER_STATUS_BADGE: Record<
  DossierStatus,
  { label: string; variant: BadgeVariant }
> = {
  NEW_LEAD: { label: "Nouveau lead", variant: "neutral" },
  RESERVATION_SENT: { label: "Réservé", variant: "info" },
  SIGNATURE_PENDING: { label: "Signature en attente", variant: "warning" },
  SIGNED_AT_NOTARY: { label: "Envoyé chez le notaire", variant: "info" },
  LOAN_OFFER_RECEIVED: { label: "Offre de prêt reçue", variant: "info" },
  ACT_SIGNED: { label: "Acte signé", variant: "success" },
  BLOCKED: { label: "Bloqué", variant: "danger" },
};

/** Ordre d'avancement du cycle commercial. `BLOCKED` est hors chaîne. */
export const DOSSIER_STATUS_ORDER: DossierStatus[] = [
  "NEW_LEAD",
  "RESERVATION_SENT",
  "SIGNATURE_PENDING",
  "SIGNED_AT_NOTARY",
  "LOAN_OFFER_RECEIVED",
  "ACT_SIGNED",
];
