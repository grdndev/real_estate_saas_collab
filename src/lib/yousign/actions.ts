"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { findDossierForUser } from "@/lib/dossier/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import {
  createSignatureRequest,
  isYousignConfigured,
} from "@/lib/yousign/client";
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

  // 1. Créer la procédure Yousign
  const procedure = await createSignatureRequest(parsed.data.procedureName, {
    firstName: parsed.data.signerFirstName,
    lastName: parsed.data.signerLastName,
    email: parsed.data.signerEmail,
  });

  // 2. Persister la signature côté Équatis
  const signature = await prisma.signature.create({
    data: {
      dossierId: dossier.id,
      documentId: parsed.data.documentId ?? null,
      yousignProcedureId: procedure.id,
      status: "CREATED",
      signerEmail: parsed.data.signerEmail,
      signerUserId: dossier.clientId,
    },
  });

  // 3. Mettre à jour le statut du dossier
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      status: "SIGNATURE_PENDING",
      lastActivityAt: new Date(),
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
  }

  await audit({
    action:
      newStatus === "SIGNED" ? "SIGNATURE_COMPLETED" : "SIGNATURE_REQUESTED",
    resourceType: "Signature",
    resourceId: signature.id,
    metadata: { newStatus, procedureId },
  });
}
