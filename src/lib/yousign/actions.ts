"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import {
  activateSignatureRequest,
  addSignatureField,
  createSignatureRequest,
  downloadSignedDocument,
  isYousignConfigured,
  listProcedureDocuments,
  uploadDocument,
} from "@/lib/yousign/client";
import { generatePlaceholderPdf } from "@/lib/storage/pdf-placeholder";
import { isStorageConfigured, putObject, readObject } from "@/lib/storage/s3";
import { randomUUID } from "node:crypto";
import { getRequestContext } from "@/lib/request-context";
import type { ActionResult } from "@/lib/auth/actions";

const requestSchema = z.object({
  dossierId: z.string().min(1),
  documentId: z.string().min(1).optional().nullable(),
  signerEmail: z.email("Email invalide"),
  signerFirstName: z.string().min(2),
  signerLastName: z.string().min(2),
  procedureName: z.string().min(2).max(120),
});
type RequestSignatureInput = z.infer<typeof requestSchema>;

export async function requestSignatureAction(
  input: RequestSignatureInput,
): Promise<ActionResult<{ signatureId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  if (!isYousignConfigured()) {
    return {
      ok: false,
      error:
        "Yousign non configuré. Renseignez YOUSIGN_API_KEY et YOUSIGN_API_URL.",
    };
  }

  const dossier = await findDossierForUser(
    parsed.data.dossierId,
    me.id,
    me.role,
  );
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const ctx = await getRequestContext();

  // Récupération du PDF à signer.
  // - Si documentId fourni : on tente de récupérer le PDF depuis S3.
  // - Sinon : on génère un placeholder à la volée (utile pour la démo).
  let pdfBuffer: Buffer;
  let pdfFileName: string;
  if (parsed.data.documentId) {
    const document = await prisma.document.findUnique({
      where: { id: parsed.data.documentId },
    });
    if (!document || document.dossierId !== dossier.id) {
      return { ok: false, error: "Document invalide pour ce dossier." };
    }
    if (document.mimeType !== "application/pdf") {
      return {
        ok: false,
        error: "Seuls les fichiers PDF peuvent être signés via Yousign.",
      };
    }
    try {
      pdfBuffer = await readObject(document.storageKey);
    } catch {
      return {
        ok: false,
        error: "Impossible de récupérer le PDF depuis le stockage.",
      };
    }
    pdfFileName = document.fileName;
  } else {
    const programme = await prisma.programme.findUnique({
      where: { id: dossier.programmeId },
      select: { name: true },
    });
    const lot = dossier.lotId
      ? await prisma.lot.findUnique({
          where: { id: dossier.lotId },
          select: { reference: true },
        })
      : null;
    pdfBuffer = generatePlaceholderPdf({
      dossierReference: dossier.reference,
      programmeName: programme?.name ?? "—",
      lotReference: lot?.reference,
      signerName: `${parsed.data.signerFirstName} ${parsed.data.signerLastName}`,
    });
    pdfFileName = `${dossier.reference}_a_signer.pdf`;
  }

  // 1. Créer la procédure Yousign (draft)
  let procedure: Awaited<ReturnType<typeof createSignatureRequest>>;
  try {
    procedure = await createSignatureRequest(parsed.data.procedureName, {
      firstName: parsed.data.signerFirstName,
      lastName: parsed.data.signerLastName,
      email: parsed.data.signerEmail,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Création procédure Yousign échouée : ${
        err instanceof Error ? err.message : "erreur inconnue"
      }`,
    };
  }
  const signerId = procedure.signers?.[0]?.id;

  // 2. Upload du PDF
  let yousignDocumentId: string;
  try {
    const doc = await uploadDocument(procedure.id, pdfFileName, pdfBuffer);
    yousignDocumentId = doc.id;
  } catch (err) {
    return {
      ok: false,
      error: `Upload PDF Yousign échoué : ${
        err instanceof Error ? err.message : "erreur inconnue"
      }`,
    };
  }

  // 3. Ajouter un champ signature au document
  if (signerId) {
    try {
      await addSignatureField(procedure.id, yousignDocumentId, signerId);
    } catch (err) {
      // Pas bloquant — on tente quand même l'activation, Yousign peut placer
      // automatiquement les fields selon le plan.
      console.warn("[yousign] addSignatureField échec", err);
    }
  }

  // 4. Activer la procédure → Yousign envoie l'email au signataire
  try {
    await activateSignatureRequest(procedure.id);
  } catch (err) {
    return {
      ok: false,
      error: `Activation Yousign échouée : ${
        err instanceof Error ? err.message : "erreur inconnue"
      }`,
    };
  }

  // 5. Persister la signature côté Équatis
  // Le signataire peut être le client OU le notaire — on relie le compte
  // correspondant à l'email s'il existe.
  const signerUser = await prisma.user.findUnique({
    where: { email: parsed.data.signerEmail },
    select: { id: true },
  });
  const signature = await prisma.signature.create({
    data: {
      dossierId: dossier.id,
      documentId: parsed.data.documentId ?? null,
      yousignProcedureId: procedure.id,
      status: "SENT",
      signerEmail: parsed.data.signerEmail,
      signerUserId: signerUser?.id ?? dossier.clientId,
    },
  });

  // 6. Mettre à jour le statut du dossier
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      status: "SIGNATURE_PENDING",
      lastActivityAt: new Date(),
    },
  });

  // Timeline event
  await prisma.timelineEvent.create({
    data: {
      dossierId: dossier.id,
      kind: "STATUS_CHANGE",
      title: `Procédure de signature envoyée à ${parsed.data.signerEmail}`,
      description: `Procédure Yousign ${procedure.id}`,
      actorId: me.id,
    },
  });

  await audit({
    userId: me.id,
    action: "SIGNATURE_REQUESTED",
    resourceType: "Signature",
    resourceId: signature.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: {
      dossierId: dossier.id,
      procedureId: procedure.id,
      signer: parsed.data.signerEmail,
      yousignDocumentId,
      hasSourceDocument: Boolean(parsed.data.documentId),
    },
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  return { ok: true, value: { signatureId: signature.id } };
}

export async function notifySignatureUpdate(
  procedureId: string,
  newStatus: "SENT" | "OPENED" | "SIGNED" | "REFUSED" | "EXPIRED",
): Promise<void> {
  const signature = await prisma.signature.findUnique({
    where: { yousignProcedureId: procedureId },
    include: {
      dossier: {
        select: {
          id: true,
          reference: true,
          clientId: true,
          participants: {
            where: {
              role: { in: ["COLLABORATOR_PRIMARY", "COLLABORATOR_SECONDARY"] },
            },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!signature) return;

  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      status: newStatus,
      ...(newStatus === "SIGNED" ? { signedAt: new Date() } : {}),
    },
  });

  if (newStatus === "SIGNED") {
    // Notifier collaborateurs + client
    for (const p of signature.dossier.participants) {
      await notify({
        userId: p.userId,
        kind: "SIGNATURE_COMPLETED",
        title: "Signature complétée",
        body: `Le document du dossier ${signature.dossier.reference} a été signé.`,
        link: `/collaborateur/dossiers/${signature.dossier.id}`,
      });
    }
    if (signature.dossier.clientId) {
      await notify({
        userId: signature.dossier.clientId,
        kind: "SIGNATURE_COMPLETED",
        title: "Votre document est signé",
        body: `Document du dossier ${signature.dossier.reference}`,
        link: "/client",
      });
    }

    // Récupération du PDF signé depuis Yousign et réintégration sur le dossier.
    await archiveSignedDocument(
      procedureId,
      signature.id,
      signature.dossierId,
      signature.documentId,
      signature.dossier.participants[0]?.userId ??
        signature.dossier.clientId ??
        signature.signerUserId,
    );
  }

  await audit({
    action:
      newStatus === "SIGNED" ? "SIGNATURE_COMPLETED" : "SIGNATURE_REQUESTED",
    resourceType: "Signature",
    resourceId: signature.id,
    metadata: { newStatus, procedureId },
  });
}

/**
 * Télécharge le PDF signé depuis Yousign et le réintègre comme Document du
 * dossier (source YOUSIGN_SIGNED) — il réapparaît ainsi sur la plateforme.
 */
async function archiveSignedDocument(
  procedureId: string,
  signatureId: string,
  dossierId: string,
  sourceDocumentId: string | null,
  uploadedById: string | null,
): Promise<void> {
  if (!isStorageConfigured() || !uploadedById) return;
  try {
    const docs = await listProcedureDocuments(procedureId);
    const yousignDocId = docs[0]?.id;
    if (!yousignDocId) return;
    const signedPdf = await downloadSignedDocument(procedureId, yousignDocId);
    const storageKey = `dossiers/${dossierId}/${randomUUID()}`;
    await putObject(storageKey, signedPdf, "application/pdf");
    const created = await prisma.document.create({
      data: {
        dossierId,
        uploadedById,
        fileName: `Document-signe-${new Date().toISOString().slice(0, 10)}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: signedPdf.byteLength,
        storageKey,
        source: "YOUSIGN_SIGNED",
        scanStatus: "CLEAN",
        scanCheckedAt: new Date(),
      },
    });
    await prisma.signature.update({
      where: { id: signatureId },
      data: { documentId: created.id },
    });
    void sourceDocumentId;
  } catch (err) {
    console.error("[yousign] archivage du document signé échoué", err);
  }
}
