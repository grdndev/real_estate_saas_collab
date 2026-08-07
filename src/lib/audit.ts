import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT"
  | "USER_LOCKED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_PASSWORD_CHANGED"
  | "DOSSIER_CREATED"
  | "DOSSIER_UPDATED"
  | "DOSSIER_TRANSMITTED_NOTARY"
  | "DOSSIER_STATUS_CHANGED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DOWNLOADED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_VISIBILITY_CHANGED"
  | "DOCUMENT_REQUEST_UPDATED"
  | "DOCUMENT_GENERATED"
  | "SIGNATURE_REQUESTED"
  | "SIGNATURE_COMPLETED"
  | "MESSAGE_SENT"
  | "PROGRAMME_CREATED"
  | "PROGRAMME_UPDATED"
  | "PROMOTER_ASSIGNED"
  | "PROMOTER_UNASSIGNED"
  | "LOT_STATUS_CHANGED"
  | "FONDS_UPDATED"
  | "NOTE_DELETED"
  | "SETTINGS_UPDATED";

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Trace une action sensible (CDC §8.6, §12). Conservation : 5 ans.
 * NE JAMAIS y stocker de données personnelles brutes (mots de passe, contenus de message).
 */
export async function audit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
