"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getRequestContext } from "@/lib/request-context";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";
import {
  createInvoiceSchema,
  type CreateInvoiceInput,
} from "@/lib/invoice/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Dépose une facture d'honoraires sur un dossier (espace Facturation).
 */
export async function createInvoiceAction(
  input: CreateInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await prisma.dossier.findUnique({
    where: { id: data.dossierId },
    select: { id: true },
  });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  // Upload optionnel du PDF de la facture.
  let storageKey: string | null = null;
  if (data.fileB64) {
    if (!isStorageConfigured()) {
      return {
        ok: false,
        error: "Stockage non configuré — impossible d'enregistrer le fichier.",
      };
    }
    try {
      const buffer = Buffer.from(data.fileB64, "base64");
      storageKey = `invoices/${dossier.id}/${randomUUID()}`;
      await putObject(storageKey, buffer, "application/pdf");
    } catch {
      return { ok: false, error: "Échec de l'enregistrement du fichier." };
    }
  }

  let invoice;
  try {
    invoice = await prisma.invoice.create({
      data: {
        dossierId: dossier.id,
        number: data.number,
        amountHT: new Prisma.Decimal(data.amountHT),
        vatRate: new Prisma.Decimal(data.vatRate),
        amountTTC: new Prisma.Decimal(data.amountTTC),
        storageKey,
        fileName: data.fileName || null,
        createdById: me.id,
        status: "DRAFT",
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ce numéro de facture existe déjà." };
    }
    throw e;
  }

  await audit({
    userId: me.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "Invoice",
    resourceId: invoice.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Facture ${data.number} créée (dossier ${dossier.id})`,
  });

  revalidatePath("/collaborateur/facturation");
  return { ok: true, value: { id: invoice.id } };
}

/** Transmet une facture d'honoraires au notaire du dossier. */
export async function sendInvoiceToNotaryAction(
  invoiceId: string,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  if (!invoiceId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      dossier: {
        select: {
          id: true,
          notaryId: true,
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (invoice.status === "SENT_TO_NOTARY") {
    return { ok: false, error: "Facture déjà transmise au notaire." };
  }
  if (!invoice.dossier.notaryId) {
    return {
      ok: false,
      error: "Aucun notaire n'est assigné à ce dossier.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT_TO_NOTARY", sentToNotaryAt: new Date() },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: invoice.dossier.id,
        kind: "INVOICE_SENT",
        title: `Facture d'honoraires ${invoice.number} transmise au notaire`,
        actorId: me.id,
      },
    });
  });

  const clientName = invoice.dossier.client
    ? `${invoice.dossier.client.firstName} ${invoice.dossier.client.lastName}`
    : "—";
  await notify({
    userId: invoice.dossier.notaryId,
    kind: "INVOICE_RECEIVED",
    title: `Facture d'honoraires — dossier ${clientName}`,
    body: `La facture ${invoice.number} vous a été transmise.`,
    link: `/notaire/${invoice.dossier.id}`,
  });

  await audit({
    userId: me.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "Invoice",
    resourceId: invoiceId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Facture ${invoice.number} transmise au notaire (dossier ${invoice.dossier.id})`,
  });

  revalidatePath("/collaborateur/facturation");
  revalidatePath(`/notaire/${invoice.dossier.id}`);
  return { ok: true, value: undefined };
}
