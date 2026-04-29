import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT"
  | "USER_LOCKED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_PASSWORD_CHANGED"
  | "DOSSIER_CREATED"
  | "DOSSIER_UPDATED"
  | "DOSSIER_TRANSMITTED_NOTARY"
  | "DOSSIER_STATUS_CHANGED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DOWNLOADED"
  | "DOCUMENT_DELETED"
  | "CLIENT_NAME_REVEALED"
  | "SIGNATURE_REQUESTED"
  | "SIGNATURE_COMPLETED"
  | "MESSAGE_SENT"
  | "PROGRAMME_CREATED"
  | "PROGRAMME_UPDATED"
  | "LOT_STATUS_CHANGED"
  | "SETTINGS_UPDATED";

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
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
      metadata: entry.metadata
        ? (JSON.parse(JSON.stringify(entry.metadata)) as object)
        : undefined,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
