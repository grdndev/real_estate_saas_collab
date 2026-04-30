"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { enqueueScan } from "@/lib/queue";
import {
  buildDocumentKey,
  deleteObject,
  isStorageConfigured,
  presignDownloadUrl,
  presignUploadUrl,
} from "@/lib/storage/s3";
import {
  documentIdSchema,
  prepareUploadSchema,
  type DocumentIdInput,
  type PrepareUploadInput,
} from "@/lib/storage/schemas";
import { getRequestContext } from "@/lib/request-context";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// =====================================================
// PREPARE UPLOAD
// =====================================================

export async function prepareUploadAction(
  input: PrepareUploadInput,
): Promise<
  ActionResult<{ documentId: string; uploadUrl: string; storageKey: string }>
> {
  const me = await requireUser();
  const parsed = prepareUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  if (!isStorageConfigured()) {
    return {
      ok: false,
      error:
        "Stockage S3 non configuré. Renseignez les variables S3_* dans le serveur.",
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }

  // Vérifie la cohérence de la source par rapport au rôle.
  if (data.source === "CLIENT_UPLOAD" && me.role !== "CLIENT") {
    return { ok: false, error: "Source CLIENT_UPLOAD réservée au client." };
  }
  if (
    data.source === "COLLABORATOR_UPLOAD" &&
    me.role !== "COLLABORATOR" &&
    me.role !== "SUPER_ADMIN"
  ) {
    return {
      ok: false,
      error: "Source COLLABORATOR_UPLOAD réservée aux collaborateurs.",
    };
  }

  // Si une demande de document est précisée, vérifier l'appartenance.
  if (data.documentRequestId) {
    const request = await prisma.documentRequest.findUnique({
      where: { id: data.documentRequestId },
    });
    if (!request || request.dossierId !== dossier.id) {
      return { ok: false, error: "Pièce demandée invalide." };
    }
  }

  // Création préalable du Document avec scanStatus=PENDING.
  const document = await prisma.document.create({
    data: {
      dossierId: dossier.id,
      uploadedById: me.id,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      storageKey: "_pending_",
      source: data.source,
      scanStatus: "PENDING",
      documentRequestId: data.documentRequestId ?? null,
    },
  });
  const storageKey = buildDocumentKey(dossier.id, document.id);
  await prisma.document.update({
    where: { id: document.id },
    data: { storageKey },
  });

  const uploadUrl = await presignUploadUrl(
    storageKey,
    data.mimeType,
    data.sizeBytes,
  );

  await audit({
    userId: me.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "Document",
    resourceId: document.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: {
      dossierId: dossier.id,
      step: "prepare",
      mime: data.mimeType,
      size: data.sizeBytes,
    },
  });

  return {
    ok: true,
    value: { documentId: document.id, uploadUrl, storageKey },
  };
}

// =====================================================
// CONFIRM UPLOAD (déclenche scan + maj DocumentRequest)
// =====================================================

export async function confirmUploadAction(
  input: DocumentIdInput,
): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };

  const document = await prisma.document.findUnique({
    where: { id: parsed.data.documentId },
  });
  if (!document) return { ok: false, error: "Document introuvable" };
  if (document.uploadedById !== me.id && me.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Accès refusé." };
  }

  await prisma.dossier.update({
    where: { id: document.dossierId! },
    data: { lastActivityAt: new Date() },
  });

  if (document.documentRequestId) {
    await prisma.documentRequest.update({
      where: { id: document.documentRequestId },
      data: { fulfilled: true },
    });
  }

  await enqueueScan(document.id);

  if (document.dossierId) {
    revalidatePath(`/collaborateur/dossiers/${document.dossierId}`);
  }
  revalidatePath("/client/documents");
  return { ok: true, value: undefined };
}

// =====================================================
// GET DOWNLOAD URL (RBAC + audit)
// =====================================================

export async function getDownloadUrlAction(
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  const me = await requireUser();
  if (!documentId) return { ok: false, error: "Identifiant manquant" };
  if (!isStorageConfigured()) {
    return { ok: false, error: "Stockage S3 non configuré." };
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document || document.deletedAt) {
    return { ok: false, error: "Document introuvable" };
  }
  if (document.scanStatus !== "CLEAN") {
    return {
      ok: false,
      error: "Document indisponible (scan en cours ou refusé).",
    };
  }

  // Vérification d'accès via le dossier rattaché.
  if (document.dossierId) {
    const dossier = await findDossierForUser(
      document.dossierId,
      me.id,
      me.role,
    );
    if (!dossier) return { ok: false, error: "Accès refusé." };
  }

  const ctx = await getRequestContext();
  const url = await presignDownloadUrl(document.storageKey, document.fileName);

  await audit({
    userId: me.id,
    action: "DOCUMENT_DOWNLOADED",
    resourceType: "Document",
    resourceId: document.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { dossierId: document.dossierId },
  });

  return { ok: true, value: { url } };
}

// =====================================================
// DELETE DOCUMENT
// =====================================================

export async function deleteDocumentAction(
  documentId: string,
): Promise<ActionResult> {
  const me = await requireUser();
  if (!documentId) return { ok: false, error: "Identifiant manquant" };

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document || document.deletedAt) {
    return { ok: false, error: "Document introuvable" };
  }

  // Le client peut supprimer ses propres uploads tant qu'aucun verrou métier.
  // Le collaborateur peut supprimer tout document du dossier auquel il a accès.
  let allowed = false;
  if (me.role === "SUPER_ADMIN") {
    allowed = true;
  } else if (me.role === "COLLABORATOR" && document.dossierId) {
    const dossier = await findDossierForUser(
      document.dossierId,
      me.id,
      me.role,
    );
    allowed = Boolean(dossier);
  } else if (me.role === "CLIENT" && document.uploadedById === me.id) {
    allowed = true;
  }
  if (!allowed) return { ok: false, error: "Accès refusé." };

  const ctx = await getRequestContext();

  await prisma.document.update({
    where: { id: document.id },
    data: { deletedAt: new Date() },
  });
  if (document.documentRequestId) {
    // Re-marquer la demande comme non fulfilled si plus aucun document attaché.
    const remaining = await prisma.document.count({
      where: {
        documentRequestId: document.documentRequestId,
        deletedAt: null,
      },
    });
    if (remaining === 0) {
      await prisma.documentRequest.update({
        where: { id: document.documentRequestId },
        data: { fulfilled: false },
      });
    }
  }

  // Suppression best-effort sur S3 (sans bloquer l'action).
  void deleteObject(document.storageKey).catch((err) => {
    console.error("[storage] échec suppression S3", document.storageKey, err);
  });

  await audit({
    userId: me.id,
    action: "DOCUMENT_DELETED",
    resourceType: "Document",
    resourceId: document.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { dossierId: document.dossierId },
  });

  if (document.dossierId) {
    revalidatePath(`/collaborateur/dossiers/${document.dossierId}`);
  }
  revalidatePath("/client/documents");
  return { ok: true, value: undefined };
}
