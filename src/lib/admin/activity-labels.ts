import type { AuditAction } from "@/lib/audit";

type BadgeVariant =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "accent"
  | "primary";

/** Libellés FR des actions d'audit (champ `AuditLog.action`). */
export const ACTION_LABEL: Record<AuditAction, string> = {
  USER_LOGIN: "Connexion",
  USER_LOGIN_FAILED: "Échec de connexion",
  USER_LOGOUT: "Déconnexion",
  USER_LOCKED: "Compte désactivé",
  USER_CREATED: "Compte créé",
  USER_UPDATED: "Compte mis à jour",
  USER_PASSWORD_CHANGED: "Mot de passe modifié",
  DOSSIER_CREATED: "Dossier créé",
  DOSSIER_UPDATED: "Dossier mis à jour",
  DOSSIER_TRANSMITTED_NOTARY: "Dossier transmis au notaire",
  DOSSIER_STATUS_CHANGED: "Statut du dossier modifié",
  DOCUMENT_UPLOADED: "Document déposé",
  DOCUMENT_DOWNLOADED: "Document téléchargé",
  DOCUMENT_DELETED: "Document supprimé",
  DOCUMENT_VISIBILITY_CHANGED: "Visibilité du document modifiée",
  DOCUMENT_REQUEST_UPDATED: "Demande de pièce mise à jour",
  DOCUMENT_GENERATED: "Document généré",
  SIGNATURE_REQUESTED: "Signature demandée",
  SIGNATURE_COMPLETED: "Signature complétée",
  MESSAGE_SENT: "Message envoyé",
  PROGRAMME_CREATED: "Programme créé",
  PROGRAMME_UPDATED: "Programme mis à jour",
  PROMOTER_ASSIGNED: "Promoteur assigné",
  PROMOTER_UNASSIGNED: "Promoteur retiré",
  LOT_STATUS_CHANGED: "Lot modifié",
  FONDS_UPDATED: "Suivi des fonds mis à jour",
  NOTE_DELETED: "Note supprimée",
  SETTINGS_UPDATED: "Paramètres modifiés",
};

export const ACTION_BADGE: Record<AuditAction, BadgeVariant> = {
  USER_LOGIN: "neutral",
  USER_LOGIN_FAILED: "danger",
  USER_LOGOUT: "neutral",
  USER_LOCKED: "danger",
  USER_CREATED: "success",
  USER_UPDATED: "info",
  USER_PASSWORD_CHANGED: "warning",
  DOSSIER_CREATED: "success",
  DOSSIER_UPDATED: "info",
  DOSSIER_TRANSMITTED_NOTARY: "accent",
  DOSSIER_STATUS_CHANGED: "accent",
  DOCUMENT_UPLOADED: "info",
  DOCUMENT_DOWNLOADED: "neutral",
  DOCUMENT_DELETED: "danger",
  DOCUMENT_VISIBILITY_CHANGED: "info",
  DOCUMENT_REQUEST_UPDATED: "info",
  DOCUMENT_GENERATED: "info",
  SIGNATURE_REQUESTED: "accent",
  SIGNATURE_COMPLETED: "success",
  MESSAGE_SENT: "neutral",
  PROGRAMME_CREATED: "success",
  PROGRAMME_UPDATED: "info",
  PROMOTER_ASSIGNED: "info",
  PROMOTER_UNASSIGNED: "warning",
  LOT_STATUS_CHANGED: "info",
  FONDS_UPDATED: "info",
  NOTE_DELETED: "danger",
  SETTINGS_UPDATED: "warning",
};

/** Libellés FR des ressources (champ `AuditLog.resourceType`). */
export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  User: "Utilisateur",
  Dossier: "Dossier",
  Programme: "Programme",
  Lot: "Lot",
  Document: "Document",
  ProgrammeDocument: "Document de programme",
  DocumentRequest: "Demande de pièce",
  Message: "Message",
  DirectMessage: "Message interne",
  Prospect: "Prospect",
  Invoice: "Facture",
  Appointment: "Rendez-vous",
  Note: "Note",
  ClientProfile: "Fiche client",
  Signature: "Signature",
  Setting: "Paramètre",
  LotFondsSuivi: "Suivi des fonds",
  AppelFonds: "Appel de fonds",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action as AuditAction] ?? action;
}

export function actionBadge(action: string): BadgeVariant {
  return ACTION_BADGE[action as AuditAction] ?? "neutral";
}

export function resourceTypeLabel(resourceType: string): string {
  return RESOURCE_TYPE_LABEL[resourceType] ?? resourceType;
}
