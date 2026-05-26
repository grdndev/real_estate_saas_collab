"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { getRequestContext } from "@/lib/request-context";
import { addNoteSchema, type AddNoteInput } from "@/lib/notes/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Ajoute une note partagée sur un prospect ou un dossier.
 * Les notes sont visibles et éditables par tous les collaborateurs (CDC évolution §2).
 */
export async function addNoteAction(
  input: AddNoteInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const note = await prisma.note.create({
    data: {
      scope: data.scope,
      prospectId: data.scope === "PROSPECT" ? data.prospectId! : null,
      dossierId: data.scope === "DOSSIER" ? data.dossierId! : null,
      authorId: me.id,
      body: data.body,
    },
  });

  await audit({
    userId: me.id,
    action: "USER_UPDATED",
    resourceType: "Note",
    resourceId: note.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { scope: data.scope },
  });

  if (data.scope === "PROSPECT") {
    revalidatePath("/collaborateur/prospects");
  } else {
    revalidatePath(`/collaborateur/dossiers/${data.dossierId}`);
  }
  return { ok: true, value: { id: note.id } };
}

/** Supprime une note. Réservé à l'auteur ou à un Super Admin. */
export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "PROMOTER", "SUPER_ADMIN"]);
  if (!noteId) return { ok: false, error: "Identifiant manquant" };

  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return { ok: false, error: "Note introuvable" };
  if (note.authorId !== me.id && me.role !== "SUPER_ADMIN") {
    return {
      ok: false,
      error: "Seul l'auteur peut supprimer cette note.",
    };
  }

  await prisma.note.delete({ where: { id: noteId } });

  if (note.scope === "PROSPECT") {
    revalidatePath("/collaborateur/prospects");
  } else if (note.dossierId) {
    revalidatePath(`/collaborateur/dossiers/${note.dossierId}`);
  }
  return { ok: true, value: undefined };
}
