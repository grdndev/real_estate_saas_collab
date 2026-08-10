"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { findDossierForUser } from "@/lib/dossier/access";
import { notify } from "@/lib/notifications";
import { getMailer } from "@/lib/mail";
import { dossierAssociatedMail } from "@/lib/mail/auto-templates";
import { createClientDossierCore } from "@/lib/dossier/client-dossier-core";
import { getRequestContext } from "@/lib/request-context";
import { hashPassword } from "@/lib/auth/password";
import { encrypt } from "@/lib/crypto";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { invitationMail } from "@/lib/mail/admin-templates";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";
import {
  buildPlaceholderEmail,
  canBeContactedByEmail,
} from "@/lib/user/no-account";
import { randomBytes, randomUUID } from "node:crypto";
import {
  assignClientSchema,
  assignCollaboratorSchema,
  createClientAndDossierSchema,
  relaunchClientSchema,
  setDossierOptionSchema,
  unassignClientSchema,
  updateContractStatusSchema,
  updateDossierStatusSchema,
  updateDossierTrackingSchema,
  type AssignClientInput,
  type UnassignClientInput,
  type CreateClientAndDossierInput,
  type RelaunchClientInput,
  type SetDossierOptionInput,
  type UpdateContractStatusInput,
  type AssignCollaboratorInput,
  type UpdateDossierStatusInput,
  type UpdateDossierTrackingInput,
} from "@/lib/dossier/schemas";
import { notifyDossierParticipants } from "@/lib/notifications";
import { DEFAULT_DOCUMENT_REQUESTS } from "@/lib/dossier/client-dossier-core";
import { revalidateLotPaths } from "@/lib/lot/revalidate";
import { CONTRACT_STATUS_LABEL } from "@/lib/dossier/labels";
import type { ContractStatus, TimelineKind } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/actions";

// Statuts contractuels donnant lieu à un événement de timeline dédié (jalon).
const CONTRACT_STATUS_TIMELINE_KIND: Partial<
  Record<ContractStatus, TimelineKind>
> = {
  RESERVATION_SIGNED: "RESERVATION_SIGNED",
  NOTARY_ACT_PENDING: "NOTARY_ACT_PENDING",
};

/**
 * Un dossier archivé est un historique en lecture seule (T10) : aucune
 * mutation métier ne doit plus l'affecter.
 */
const ARCHIVED_DOSSIER_ERROR =
  "Ce dossier est archivé (historique d'un client dissocié) : il est en lecture seule.";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const STATUS_TIMELINE_KIND = {
  NEW_LEAD: "LEAD_CREATED",
  RESERVATION_SENT: "RESERVATION_SENT",
  SIGNATURE_PENDING: "STATUS_CHANGE",
  SIGNED_AT_NOTARY: "TRANSMITTED_TO_NOTARY",
  LOAN_OFFER_RECEIVED: "LOAN_OFFER_RECEIVED",
  ACT_SIGNED: "ACT_SIGNED",
  BLOCKED: "STATUS_CHANGE",
} as const;

/** La grille du programme affiche l'état de ses lots : elle suit l'association. */
function revalidateProgrammePaths(programmeId: string): void {
  revalidatePath(`/admin/programmes/${programmeId}`);
  revalidatePath(`/collaborateur/programmes/${programmeId}`);
}

// =====================================================
// UPDATE STATUS
// =====================================================

export async function updateDossierStatusAction(
  input: UpdateDossierStatusInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = updateDossierStatusSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (dossier.status === data.status) {
    return { ok: false, error: "Le dossier a déjà ce statut." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        status: data.status,
        lastActivityAt: new Date(),
        ...(data.status === "ACT_SIGNED" ? { closedAt: new Date() } : {}),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: STATUS_TIMELINE_KIND[data.status],
        title: `Statut → ${data.status}`,
        description: data.comment ?? null,
        actorId: me.id,
      },
    });
    if (data.status === "ACT_SIGNED") {
      await tx.lot.updateMany({
        where: { dossierId: dossier.id },
        data: { status: "SOLD" },
      });
    }
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_STATUS_CHANGED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Statut du dossier modifié : ${dossier.status} → ${data.status}`,
  });

  revalidateLotPaths(dossier.lotId);
  return { ok: true, value: undefined };
}

// =====================================================
// ASSIGN CLIENT (associer un client à un lot libre)
// =====================================================

/**
 * Associe un client à un lot.
 *
 * - le client avait déjà un dossier sur CE lot → ce dossier est réactivé tel
 *   quel (messages, documents, timeline, factures) et le lot repointe dessus ;
 * - sinon → un dossier neuf est créé pour le couple (lot, client).
 *
 * Un client peut porter plusieurs dossiers actifs, un par lot.
 */
export async function assignClientAction(
  input: AssignClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = assignClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const client = await prisma.user.findUnique({
    where: { id: data.clientId },
  });
  if (!client || client.role !== "CLIENT" || client.deletedAt) {
    return { ok: false, error: "Client invalide." };
  }

  const lot = await prisma.lot.findUnique({ where: { id: data.lotId } });
  if (!lot) return { ok: false, error: "Lot introuvable." };
  if (lot.dossierId) {
    return {
      ok: false,
      error: "Ce lot a déjà un client associé : dissociez-le d'abord.",
    };
  }

  // Historique : ce client a-t-il déjà eu un dossier sur ce lot ?
  const existing = await prisma.dossier.findUnique({
    where: { lotId_clientId: { lotId: data.lotId, clientId: data.clientId } },
  });

  // Un client sans compte (T7) ne devient jamais ACTIVE : il n'a pas d'accès.
  const clientStatus = client.status === "NO_ACCOUNT" ? "NO_ACCOUNT" : "ACTIVE";
  const clientName = `${client.firstName} ${client.lastName}`;

  let dossierId: string;
  try {
    dossierId = await prisma.$transaction(async (tx) => {
      const dossier = existing
        ? await tx.dossier.update({
            where: { id: existing.id },
            data: { archivedAt: null, lastActivityAt: new Date() },
          })
        : await tx.dossier.create({
            data: {
              lotId: data.lotId,
              clientId: data.clientId,
              status: "NEW_LEAD",
              lastActivityAt: new Date(),
            },
          });

      if (existing) {
        await tx.timelineEvent.create({
          data: {
            dossierId: dossier.id,
            kind: "STATUS_CHANGE",
            title: "Dossier réactivé",
            description: `${clientName} — historique restitué`,
            actorId: me.id,
          },
        });
      } else {
        // Dossier neuf : référent, pièces standard et événement de création.
        if (me.role === "COLLABORATOR") {
          await tx.dossierParticipant.create({
            data: {
              dossierId: dossier.id,
              userId: me.id,
              role: "COLLABORATOR_PRIMARY",
            },
          });
        }
        await tx.documentRequest.createMany({
          data: DEFAULT_DOCUMENT_REQUESTS.map((r) => ({
            dossierId: dossier.id,
            label: r.label,
            required: r.required,
          })),
        });
        await tx.timelineEvent.create({
          data: {
            dossierId: dossier.id,
            kind: "LEAD_CREATED",
            title: "Dossier créé et client associé",
            description: clientName,
            actorId: me.id,
          },
        });
      }

      // Le lot pointe vers son dossier actif et passe en réservé.
      await tx.lot.update({
        where: { id: data.lotId },
        data: {
          dossierId: dossier.id,
          ...(lot.status === "SOLD" ? {} : { status: "RESERVED" as const }),
        },
      });
      await tx.user.update({
        where: { id: data.clientId },
        data: { status: clientStatus },
      });
      return dossier.id;
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ce client est déjà associé à ce lot." };
    }
    throw e;
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossierId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: existing
      ? `Client ${data.clientId} réassocié au lot ${lot.reference} — dossier réactivé avec son historique`
      : `Client ${data.clientId} associé au lot ${lot.reference} — dossier créé`,
  });

  // Un client sans compte n'est ni notifié ni relancé par email (T7).
  if (client.status !== "NO_ACCOUNT") {
    // Notifier le client de l'association (déclencheur CDC §8.5)
    await notify({
      userId: data.clientId,
      kind: "DOSSIER_ASSOCIATED",
      title: "Votre dossier est prêt",
      body: `Votre dossier a été créé. Vous pouvez maintenant suivre son avancement.`,
      link: `/client/${dossierId}`,
    });
    // Email auto (CDC §8.5)
    void getMailer()
      .send(dossierAssociatedMail(client.email, client.firstName))
      .catch((err) => {
        console.error("[mail] dossierAssociated", err);
      });
  }

  revalidateLotPaths(lot.id);
  revalidateProgrammePaths(lot.programmeId);
  return { ok: true, value: undefined };
}

// =====================================================
// UNASSIGN CLIENT (dissocier le client d'un lot)
// =====================================================

/**
 * Dissocie le client du lot : `Lot.dossierId` est effacé et le dossier est
 * archivé tel quel — messages, documents, timeline, notes et factures sont
 * conservés et restitués si ce client est réassocié à ce lot.
 */
export async function unassignClientAction(
  input: UnassignClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = unassignClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide" };
  }
  const ctx = await getRequestContext();

  const lot = await prisma.lot.findUnique({
    where: { id: parsed.data.lotId },
    include: { dossier: { include: { client: true } } },
  });
  if (!lot) return { ok: false, error: "Lot introuvable." };
  const dossier = lot.dossier;
  if (!dossier) {
    return { ok: false, error: "Ce lot n'a pas de client associé." };
  }

  const client = dossier.client;
  const clientName = `${client.firstName} ${client.lastName}`;
  // Le compte redevient « en attente » seulement s'il ne reste aucun autre
  // dossier actif ; un client sans compte (T7) garde son statut NO_ACCOUNT.
  const otherActiveDossiers = await prisma.dossier.count({
    where: { clientId: client.id, archivedAt: null, id: { not: dossier.id } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "STATUS_CHANGE",
        title: "Client dissocié — dossier archivé",
        description: clientName,
        actorId: me.id,
      },
    });
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { archivedAt: new Date(), lastActivityAt: new Date() },
    });
    // Le lot redevient libre : il pourra recevoir un nouveau client.
    await tx.lot.update({
      where: { id: lot.id },
      data: {
        dossierId: null,
        ...(lot.status === "SOLD" ? {} : { status: "AVAILABLE" as const }),
      },
    });
    if (client.status !== "NO_ACCOUNT" && otherActiveDossiers === 0) {
      await tx.user.update({
        where: { id: client.id },
        data: { status: "PENDING_ASSOCIATION" },
      });
    }
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Client ${client.id} (${clientName}) dissocié du lot ${lot.reference} — dossier archivé, historique conservé`,
  });

  revalidateLotPaths(lot.id);
  revalidateProgrammePaths(lot.programmeId);
  revalidatePath("/collaborateur/fonds");
  revalidatePath("/admin/fonds");
  revalidatePath(`/collaborateur/fonds/${lot.id}`);
  revalidatePath(`/admin/fonds/${lot.id}`);
  return { ok: true, value: undefined };
}

// =====================================================
// ASSIGN COLLABORATOR
// =====================================================

export async function assignCollaboratorAction(
  input: AssignCollaboratorInput,
): Promise<ActionResult> {
  const me = await requireRole(["SUPER_ADMIN", "COLLABORATOR"]);
  const parsed = assignCollaboratorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  const data = parsed.data;
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(data.dossierId, me.id, me.role);
  if (!dossier) return { ok: false, error: "Dossier introuvable" };

  await prisma.dossierParticipant.upsert({
    where: {
      dossierId_userId_role: {
        dossierId: data.dossierId,
        userId: data.collaboratorId,
        role: data.role,
      },
    },
    create: {
      dossierId: data.dossierId,
      userId: data.collaboratorId,
      role: data.role,
    },
    update: {},
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: data.dossierId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Collaborateur associé au dossier avec le rôle ${data.role}`,
  });
  revalidateLotPaths(dossier.lotId);
  return { ok: true, value: undefined };
}

// =====================================================
// CREATE CLIENT + DOSSIER (collaborateur crée un espace client)
// =====================================================

export async function createClientAndDossierAction(
  input: CreateClientAndDossierInput,
): Promise<ActionResult<{ dossierId: string; userId: string; lotId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = createClientAndDossierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  // Un client sans compte peut ne pas avoir d'email : on lui attribue alors une
  // adresse technique, jamais affichée ni utilisée pour un envoi (T7).
  const providedEmail = data.email?.trim() ? data.email.trim() : null;
  if (!providedEmail && !data.noAccount) {
    return {
      ok: false,
      error: "Un email est requis pour un client disposant d'un accès.",
    };
  }
  const email = providedEmail ?? buildPlaceholderEmail();

  if (providedEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: providedEmail },
    });
    if (existing) {
      return {
        ok: false,
        error:
          "Un compte existe déjà avec cet email. Utilisez plutôt « Associer un client existant ».",
      };
    }
  }

  // Le lot porte le programme : inutile de le demander séparément.
  const lot = await prisma.lot.findUnique({
    where: { id: data.lotId },
    include: { programme: { select: { id: true, status: true } } },
  });
  if (!lot || lot.programmeId !== data.programmeId) {
    return { ok: false, error: "Lot incompatible avec ce programme." };
  }
  if (lot.programme.status !== "ACTIVE") {
    return { ok: false, error: "Programme inactif." };
  }
  if (lot.dossierId) {
    return { ok: false, error: "Ce lot a déjà un client associé." };
  }

  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  const FAMILY_STATUSES = [
    "SINGLE",
    "MARRIED",
    "PACS",
    "DIVORCED",
    "WIDOWED",
    "COHABITING",
  ];
  const parseProfileDate = (v?: string): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const familyStatus =
    data.familyStatus && FAMILY_STATUSES.includes(data.familyStatus)
      ? (data.familyStatus as
          | "SINGLE"
          | "MARRIED"
          | "PACS"
          | "DIVORCED"
          | "WIDOWED"
          | "COHABITING")
      : null;
  // La fiche client n'est créée que si au moins un champ étendu est rempli.
  const hasProfileData = Boolean(
    data.birthName ||
    data.birthDate ||
    data.birthPlace ||
    data.profession ||
    data.nationality ||
    familyStatus ||
    data.marriageDate ||
    data.marriagePlace ||
    data.marriageContract,
  );
  // Adresse structurée — unique source : User.addressEnc (même format que /profil).
  const hasAddress = Boolean(
    data.addressLine || data.postalCode || data.city || data.country,
  );

  const { dossier, user, token } = await prisma.$transaction(async (tx) => {
    const core = await createClientDossierCore(tx, {
      email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      lotId: data.lotId,
      passwordHash: placeholderHash,
      noAccount: data.noAccount,
      collaboratorId: me.id,
      actorId: me.id,
      timelineTitle: `Dossier créé par ${me.name ?? "le collaborateur"}`,
      initialNote: data.initialNote ?? null,
    });
    if (hasAddress) {
      await tx.user.update({
        where: { id: core.user.id },
        data: {
          addressEnc: encrypt(
            JSON.stringify({
              line: data.addressLine ?? "",
              postalCode: data.postalCode ?? "",
              city: data.city ?? "",
              country: data.country ?? "",
            }),
          ),
        },
      });
    }
    if (hasProfileData) {
      await tx.clientProfile.create({
        data: {
          userId: core.user.id,
          birthName: data.birthName || null,
          birthDate: parseProfileDate(data.birthDate),
          birthPlace: data.birthPlace || null,
          profession: data.profession || null,
          nationality: data.nationality || null,
          familyStatus,
          marriageDate: parseProfileDate(data.marriageDate),
          marriagePlace: data.marriagePlace || null,
          marriageContract: data.marriageContract || null,
        },
      });
    }
    return core;
  });

  // Un client sans compte n'est jamais invité : pas de jeton, pas d'email (T7).
  if (token) {
    try {
      await getMailer().send(
        invitationMail(user.email, user.firstName, "CLIENT", token),
      );
    } catch (err) {
      console.error("[mail] createClient invitation", err);
    }
  }

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: data.noAccount
      ? `Client associé sans compte créé par un collaborateur (dossier ${dossier.id})`
      : `Compte client créé par un collaborateur (dossier ${dossier.id})`,
  });
  await audit({
    userId: me.id,
    action: "DOSSIER_CREATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Dossier créé avec un nouveau client sur le lot ${lot.reference}`,
  });

  // Pièces déposées dès la création (best-effort — n'invalide pas la création).
  if (isStorageConfigured()) {
    if (data.cniFileB64) {
      await attachCreationDocument(
        dossier.id,
        me.id,
        data.cniFileB64,
        data.cniFileName || "CNI-client.pdf",
        "CNI du client",
      );
    }
    if (data.marriageContractFileB64) {
      await attachCreationDocument(
        dossier.id,
        me.id,
        data.marriageContractFileB64,
        data.marriageContractFileName || "Contrat-de-mariage.pdf",
        null,
      );
    }
  }

  // RDV notaire déjà fixé à la création.
  if (data.notaryAppointmentAt) {
    const when = new Date(data.notaryAppointmentAt);
    if (!Number.isNaN(when.getTime())) {
      try {
        await prisma.appointment.create({
          data: {
            dossierId: dossier.id,
            scheduledAt: when,
            createdById: me.id,
            status: "SCHEDULED",
          },
        });
        await prisma.dossier.update({
          where: { id: dossier.id },
          data: { contractStatus: "NOTARY_APPOINTMENT_SCHEDULED" },
        });
        await prisma.timelineEvent.create({
          data: {
            dossierId: dossier.id,
            kind: "APPOINTMENT_SCHEDULED",
            title: "Rendez-vous notaire planifié",
            description: when.toLocaleString("fr-FR"),
            actorId: me.id,
          },
        });
      } catch (err) {
        console.error("[createClient] appointment", err);
      }
    }
  }

  revalidatePath("/collaborateur");
  revalidateLotPaths(data.lotId);
  revalidateProgrammePaths(lot.programmeId);
  revalidatePath("/collaborateur/facturation");
  return {
    ok: true,
    value: { dossierId: dossier.id, userId: user.id, lotId: data.lotId },
  };
}

// =====================================================
// CREATE CLIENT ONLY (sans dossier — pour l'import tracking)
// =====================================================

const createClientOnlySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

export async function createClientOnlyAction(
  input: unknown,
): Promise<ActionResult<{ userId: string }>> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = createClientOnlySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    return {
      ok: false,
      error:
        "Un compte existe déjà avec cet email. Utilisez plutôt « Associer un client existant ».",
    };
  }

  const placeholderHash = await hashPassword(randomBytes(32).toString("hex"));

  const { user, token } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        role: "CLIENT",
        passwordHash: placeholderHash,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        phoneEnc: data.phone ? encrypt(data.phone) : null,
      },
    });
    const { token: rawToken, hash } = generateOpaqueToken();
    await tx.passwordReset.create({
      data: {
        userId: createdUser.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
    });
    return { user: createdUser, token: rawToken };
  });

  try {
    await getMailer().send(
      invitationMail(user.email, user.firstName, "CLIENT", token),
    );
  } catch (err) {
    console.error("[mail] createClientOnly invitation", err);
  }

  await audit({
    userId: me.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Compte client créé via l'import d'un fichier de suivi",
  });

  return { ok: true, value: { userId: user.id } };
}

/** Dépose un PDF sur un dossier et, si fourni, marque la pièce demandée comme fournie. */
async function attachCreationDocument(
  dossierId: string,
  uploadedById: string,
  fileB64: string,
  fileName: string,
  requestLabel: string | null,
): Promise<void> {
  try {
    const buffer = Buffer.from(fileB64, "base64");
    const storageKey = `dossiers/${dossierId}/${randomUUID()}`;
    await putObject(storageKey, buffer, "application/pdf");
    const documentRequest = requestLabel
      ? await prisma.documentRequest.findFirst({
          where: { dossierId, label: requestLabel },
        })
      : null;
    await prisma.document.create({
      data: {
        dossierId,
        uploadedById,
        fileName,
        mimeType: "application/pdf",
        sizeBytes: buffer.byteLength,
        storageKey,
        source: "COLLABORATOR_UPLOAD",
        scanStatus: "CLEAN",
        scanCheckedAt: new Date(),
        documentRequestId: documentRequest?.id ?? null,
      },
    });
    if (documentRequest) {
      await prisma.documentRequest.update({
        where: { id: documentRequest.id },
        data: { fulfilled: true },
      });
    }
  } catch (err) {
    console.error("[createClient] attachDocument", err);
  }
}

// =====================================================
// RELANCE CLIENT (bouton dans la fiche dossier collab)
// =====================================================

export async function relaunchClientAction(
  input: RelaunchClientInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = relaunchClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const ctx = await getRequestContext();
  const dossier = await findDossierForUser(
    parsed.data.dossierId,
    me.id,
    me.role,
  );
  if (!dossier) return { ok: false, error: "Dossier introuvable." };
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (!dossier.clientId) {
    return { ok: false, error: "Aucun client associé à ce dossier." };
  }

  // Anti-spam : refus si une relance client a été envoyée < 12h.
  const recent = await prisma.auditLog.findFirst({
    where: {
      action: "DOSSIER_UPDATED",
      resourceType: "Dossier",
      resourceId: dossier.id,
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60_000) },
      metadata: { startsWith: "Client relancé" },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const minutesAgo = Math.round(
      (Date.now() - recent.createdAt.getTime()) / 60_000,
    );
    return {
      ok: false,
      error: `Relance déjà envoyée il y a ${minutesAgo} min. Patientez 12h.`,
    };
  }

  const client = await prisma.user.findUnique({
    where: { id: dossier.clientId },
  });
  if (!client) return { ok: false, error: "Client introuvable." };
  // Un client sans compte n'est jamais relancé par email (T7).
  if (!canBeContactedByEmail(client)) {
    return {
      ok: false,
      error:
        "Ce client est un client associé sans compte : il ne reçoit ni email ni notification.",
    };
  }

  // Email
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const link = `${baseUrl}/client`;
  try {
    await getMailer().send({
      to: client.email,
      subject: `[Équatis] Action requise sur votre dossier`,
      text:
        `Bonjour ${client.firstName},\n\n` +
        (parsed.data.comment
          ? `${parsed.data.comment}\n\n`
          : "Nous attendons des informations de votre part pour faire avancer votre dossier.\n\n") +
        `Lien direct : ${link}`,
      html: `<div style="font-family:Inter,sans-serif;background:#F8F9FA;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e6eb"><p style="color:#0FB8A9;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0">Équatis</p><h1 style="color:#1B2A4A;font-size:20px;margin:8px 0 16px">Votre dossier</h1><p style="color:#1B2A4A;font-size:14px">Bonjour ${client.firstName},</p>${parsed.data.comment ? `<div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #0FB8A9;border-radius:4px"><p style="color:#475569;font-size:14px;margin:0;white-space:pre-line">${parsed.data.comment.replace(/</g, "&lt;")}</p></div>` : `<p style="color:#475569;font-size:14px">Nous attendons des informations de votre part pour faire avancer votre dossier.</p>`}<p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#1B2A4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">Accéder à mon dossier</a></p></div></div>`,
    });
  } catch (err) {
    console.error("[mail] clientRelaunch", err);
    return { ok: false, error: "Échec de l'envoi de l'email." };
  }

  // Notif in-app
  await notify({
    userId: client.id,
    kind: "DOSSIER_INACTIVE",
    title: "Relance — votre dossier",
    body:
      parsed.data.comment ??
      "Votre collaborateur attend une action de votre part.",
    link: "/client",
  });

  // Timeline + activité
  await prisma.dossier.update({
    where: { id: dossier.id },
    data: { lastActivityAt: new Date() },
  });
  await prisma.timelineEvent.create({
    data: {
      dossierId: dossier.id,
      kind: "STATUS_CHANGE",
      title: "Client relancé par email",
      description: parsed.data.comment ?? null,
      actorId: me.id,
    },
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Client relancé sur le dossier${parsed.data.comment ? ", avec commentaire" : ""}`,
  });

  revalidateLotPaths(dossier.lotId);
  return { ok: true, value: undefined };
}

// =====================================================
// DOSSIER OPTIONNÉ — capable d'acheter mais avec délai (CDC évolution §2)
// =====================================================

export async function setDossierOptionAction(
  input: SetDossierOptionInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = setDossierOptionSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };

  const expiresAt = data.optioned
    ? new Date(Date.now() + data.optionDelayDays * 24 * 3600_000)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: {
        optioned: data.optioned,
        optionExpiresAt: expiresAt,
        lastActivityAt: new Date(),
      },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "OPTION_TAKEN",
        title: data.optioned
          ? `Dossier optionné — délai ${data.optionDelayDays} jours`
          : "Option levée",
        description: expiresAt
          ? `Échéance le ${expiresAt.toLocaleDateString("fr-FR")}`
          : null,
        actorId: me.id,
      },
    });
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: data.optioned
      ? "Option posée sur le dossier"
      : "Option retirée du dossier",
  });

  revalidateLotPaths(dossier.lotId);
  revalidatePath("/collaborateur/clients-en-attente");
  return { ok: true, value: undefined };
}

// =====================================================
// RELANCE D'UNE OPTION — trace la relance dans l'historique
// =====================================================

export async function recordOptionReminderAction(
  dossierId: string,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  if (!dossierId) return { ok: false, error: "Identifiant manquant" };
  const ctx = await getRequestContext();

  const dossier = await findDossierForUser(dossierId, me.id, me.role);
  if (!dossier) {
    return { ok: false, error: "Dossier introuvable ou accès refusé." };
  }
  if (!dossier.optioned) {
    return { ok: false, error: "Ce dossier n'est pas optionné." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { lastActivityAt: new Date() },
    });
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: "OPTION_REMINDER",
        title: "Relance de l'option effectuée",
        description: dossier.optionExpiresAt
          ? `Échéance : ${dossier.optionExpiresAt.toLocaleDateString("fr-FR")}`
          : null,
        actorId: me.id,
      },
    });
  });

  if (dossier.clientId) {
    await notify({
      userId: dossier.clientId,
      kind: "OPTION_REMINDER",
      title: "Relance — votre dossier",
      body: "Votre option arrive à échéance. Contactez votre conseiller.",
      link: "/client",
    });
  }

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Relance de l'option envoyée au client",
  });

  revalidateLotPaths(dossier.lotId);
  revalidatePath("/collaborateur/clients-en-attente");
  return { ok: true, value: undefined };
}

// =====================================================
// SUIVI COMPLÉMENTAIRE — dates brutes du process de vente
// =====================================================

/**
 * `YYYY-MM-DD` → minuit UTC, comme l'import de tracking
 * (`src/lib/collaborateur/tracking-import.ts`) : la date calendaire ne doit pas
 * dépendre du fuseau du serveur.
 */
function trackingDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export async function updateDossierTrackingAction(
  input: UpdateDossierTrackingInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = updateDossierTrackingSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };

  await prisma.dossier.update({
    where: { id: dossier.id },
    data: {
      observation: data.observation || null,
      financingMode: data.financingMode || null,
      clientAtRsm: data.clientAtRsm === "" ? null : data.clientAtRsm === "oui",
      guaranteeDepositAmount: data.guaranteeDepositAmount,
      kbisObtainedAt: trackingDate(data.kbisObtainedAt),
      reservationSignedAt: trackingDate(data.reservationSignedAt),
      deposit200ReceivedAt: trackingDate(data.deposit200ReceivedAt),
      guaranteeDepositReceivedAt: trackingDate(data.guaranteeDepositReceivedAt),
      rarSentByNotaryAt: trackingDate(data.rarSentByNotaryAt),
      loanFiledAt: trackingDate(data.loanFiledAt),
      loanObtainedAt: trackingDate(data.loanObtainedAt),
      reservationEndDate: trackingDate(data.reservationEndDate),
      actSignedAt: trackingDate(data.actSignedAt),
      lastActivityAt: new Date(),
    },
  });

  await audit({
    userId: me.id,
    action: "DOSSIER_UPDATED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: "Suivi complémentaire du dossier mis à jour",
  });

  revalidateLotPaths(dossier.lotId);
  return { ok: true, value: undefined };
}

// =====================================================
// STATUT CONTRACTUEL — axe parallèle (CDC évolution §4)
// =====================================================

export async function updateContractStatusAction(
  input: UpdateContractStatusInput,
): Promise<ActionResult> {
  const me = await requireRole(["COLLABORATOR", "SUPER_ADMIN"]);
  const parsed = updateContractStatusSchema.safeParse(input);
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
  if (dossier.archivedAt) return { ok: false, error: ARCHIVED_DOSSIER_ERROR };
  if (dossier.contractStatus === data.contractStatus) {
    return { ok: false, error: "Le dossier a déjà ce statut contractuel." };
  }

  const label = CONTRACT_STATUS_LABEL[data.contractStatus];

  await prisma.$transaction(async (tx) => {
    await tx.dossier.update({
      where: { id: dossier.id },
      data: { contractStatus: data.contractStatus, lastActivityAt: new Date() },
    });
    const dedicatedKind = CONTRACT_STATUS_TIMELINE_KIND[data.contractStatus];
    await tx.timelineEvent.create({
      data: {
        dossierId: dossier.id,
        kind: dedicatedKind ?? "CONTRACT_STATUS_CHANGE",
        title: dedicatedKind ? label : `Contrat → ${label}`,
        description: data.comment ?? null,
        actorId: me.id,
      },
    });
  });

  const client = dossier.clientId
    ? await prisma.user.findUnique({
        where: { id: dossier.clientId },
        select: { firstName: true, lastName: true },
      })
    : null;
  await notifyDossierParticipants(
    dossier.id,
    me.id,
    "CONTRACT_STATUS_CHANGE",
    `Dossier${client ? ` ${client.firstName} ${client.lastName}` : ""} — ${label}`,
    data.comment ?? null,
  );

  await audit({
    userId: me.id,
    action: "DOSSIER_STATUS_CHANGED",
    resourceType: "Dossier",
    resourceId: dossier.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: `Statut contractuel du dossier modifié : ${dossier.contractStatus} → ${data.contractStatus}`,
  });

  revalidateLotPaths(dossier.lotId);
  return { ok: true, value: undefined };
}
