"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify, notifyDossierParticipants } from "@/lib/notifications";
import { getRequestContext } from "@/lib/request-context";
import {
  createAppointmentSchema,
  type CreateAppointmentInput,
} from "@/lib/appointment/schemas";
import type { ActionResult } from "@/lib/auth/actions";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/**
 * Planifie un rendez-vous notaire pour un dossier.
 * L'information est diffusée aux 3 espaces (collaborateur, client, promoteur)
 * et à l'équipe de facturation (CDC évolution §2 & §3).
 */
export async function createAppointmentAction(
  input: CreateAppointmentInput,
): Promise<ActionResult<{ id: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN", "NOTARY"]);
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }

  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Date du rendez-vous invalide." };
  }

  const localeTime = new Date(data.localeTime);
  if (Number.isNaN(localeTime.getTime())) {
    return { ok: false, error: "Date du rendez-vous invalide." };
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        dossierId: dossier.id,
        scheduledAt,
        location: data.location || null,
        notes: data.notes || null,
        notaryId: dossier.notaryId,
        createdById: me.id,
        status: "SCHEDULED",
      },
    });
    // Le RDV planifié fait avancer l'axe contractuel.
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        contractStatus: "NOTARY_APPOINTMENT_SCHEDULED",
        lastActivityAt: new Date(),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "APPOINTMENT_SCHEDULED",
        title: "Rendez-vous notaire planifié",
        description: `${localeTime.toLocaleString("fr-FR")}${
          data.location ? ` — ${data.location}` : ""
        }`,
        actorId: me.id,
      },
    });
    return created;
  });

  const whenLabel = localeTime.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const client = dossier.clientId
    ? await prisma.user.findUnique({
        where: { id: dossier.clientId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const clientName = client ? `${client.firstName} ${client.lastName}` : "—";

  // Diffusion : collaborateurs participants, client, notaire, promoteurs.
  await notifyDossierParticipants(
    dossier.id,
    me.id,
    "APPOINTMENT_SCHEDULED",
    `RDV notaire — dossier ${clientName}`,
    `Rendez-vous prévu le ${whenLabel}.`,
  );

  // Diffusion à l'équipe de facturation : tous les collaborateurs actifs.
  const collaborators = await prisma.user.findMany({
    where: { role: "COLLABORATOR", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  await Promise.all(
    collaborators
      .filter((c) => c.id !== me.id)
      .map((c) =>
        notify({
          userId: c.id,
          kind: "APPOINTMENT_SCHEDULED",
          title: `RDV notaire confirmé — dossier ${clientName}`,
          body: `Facturation : honoraires à préparer. RDV le ${whenLabel}.`,
          link: "/collaborateur/facturation",
        }),
      ),
  );

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Appointment",
    resourceId: appointment.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Rendez-vous notaire créé (dossier ${dossier.id})`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/collaborateur/facturation");
  revalidatePath("/client");
  revalidatePath(`/notaire/${dossier.id}`);
  return { ok: true, value: { id: appointment.id } };
}

/** Annule un rendez-vous notaire. */
export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN", "NOTARY"]);
  if (!appointmentId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment) return { ok: false, error: "Rendez-vous introuvable" };

  const dossier = await findDossierForUser(
    appointment.dossierId,
    me.id,
    me.role,
  );
  if (!dossier) return { ok: false, error: "Accès refusé." };

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });

  const client = dossier.clientId
    ? await prisma.user.findUnique({
        where: { id: dossier.clientId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const clientName = client ? `${client.firstName} ${client.lastName}` : "—";

  await notifyDossierParticipants(
    dossier.id,
    me.id,
    "APPOINTMENT_SCHEDULED",
    `RDV notaire annulé — dossier ${clientName}`,
    "Le rendez-vous notaire a été annulé.",
  );

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Appointment",
    resourceId: appointmentId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Rendez-vous notaire annulé (dossier ${dossier.id})`,
  });

  revalidatePath(`/collaborateur/dossiers/${dossier.id}`);
  revalidatePath("/client");
  return { ok: true, value: undefined };
}
