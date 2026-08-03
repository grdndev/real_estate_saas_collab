import type { Prisma } from "@/generated/prisma/client";
import { encrypt } from "@/lib/crypto";
import { generateOpaqueToken } from "@/lib/auth/tokens";

/**
 * Cœur transactionnel de création d'un compte client (rôle CLIENT) + son dossier.
 *
 * Partagé entre `createClientAndDossierAction` (formulaire collaborateur) et
 * `convertProspectAction` (conversion d'un prospect réservataire), pour garantir
 * un flux unique et une atomicité complète (tout est écrit dans le même `tx`).
 *
 * NB : ce module n'est volontairement PAS `"use server"` — il exporte un helper
 * prenant un client de transaction Prisma (non sérialisable), ce qui est interdit
 * pour un module de server actions.
 */

/** Pièces justificatives standard demandées à l'acquéreur (CDC évolution §4). */
export const DEFAULT_DOCUMENT_REQUESTS = [
  { label: "CNI du client", required: true },
  { label: "CNI du conjoint", required: false },
  { label: "Justificatif de domicile", required: true },
] as const;

export interface CreateClientDossierCoreParams {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  programmeId: string;
  lotId?: string | null;
  /** Hash de mot de passe placeholder (calculé hors transaction). */
  passwordHash: string;
  /**
   * « Client associé » sans accès à la plateforme (T7) : statut NO_ACCOUNT,
   * aucun jeton d'invitation généré, aucun email envoyé.
   */
  noAccount?: boolean;
  /**
   * Collaborateur référent du dossier (participant COLLABORATOR_PRIMARY).
   * `null` si aucun collaborateur n'est déterminable (ex. conversion par un
   * promoteur sur un prospect sans owner) — il pourra être assigné plus tard.
   */
  collaboratorId: string | null;
  /** Auteur de l'événement timeline (n'importe quel rôle). */
  actorId: string;
  timelineTitle: string;
  initialNote?: string | null;
}

export interface CreateClientDossierCoreResult {
  dossier: { id: string };
  user: { id: string; email: string; firstName: string };
  /**
   * Token brut d'invitation (à envoyer par email hors transaction).
   * `null` pour un client sans compte : il n'est jamais invité.
   */
  token: string | null;
}

/**
 * Écrit, dans le `tx` fourni : User CLIENT (actif, email vérifié), Dossier
 * (NEW_LEAD), participant collaborateur principal (si fourni), réservation du
 * lot, événement timeline LEAD_CREATED, pièces demandées standard et jeton
 * d'accès (via PasswordReset, valable 7 jours).
 */
export async function createClientDossierCore(
  tx: Prisma.TransactionClient,
  params: CreateClientDossierCoreParams,
): Promise<CreateClientDossierCoreResult> {
  const noAccount = params.noAccount === true;
  const createdUser = await tx.user.create({
    data: {
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: "CLIENT",
      passwordHash: params.passwordHash,
      // Un client sans compte n'a pas d'email vérifié : il n'en utilise pas.
      emailVerifiedAt: noAccount ? null : new Date(),
      status: noAccount ? "NO_ACCOUNT" : "ACTIVE",
      phoneEnc: params.phone ? encrypt(params.phone) : null,
    },
  });

  const createdDossier = await tx.dossier.create({
    data: {
      programmeId: params.programmeId,
      clientId: createdUser.id,
      status: "NEW_LEAD",
    },
  });

  if (params.collaboratorId) {
    await tx.dossierParticipant.create({
      data: {
        dossierId: createdDossier.id,
        userId: params.collaboratorId,
        role: "COLLABORATOR_PRIMARY",
      },
    });
  }

  if (params.lotId) {
    await tx.lot.update({
      where: { id: params.lotId },
      data: { dossierId: createdDossier.id, status: "RESERVED" },
    });
  }

  await tx.timelineEvent.create({
    data: {
      dossierId: createdDossier.id,
      kind: "LEAD_CREATED",
      title: params.timelineTitle,
      description: params.initialNote ?? null,
      actorId: params.actorId,
    },
  });

  await tx.documentRequest.createMany({
    data: DEFAULT_DOCUMENT_REQUESTS.map((r) => ({
      dossierId: createdDossier.id,
      label: r.label,
      required: r.required,
    })),
  });

  // Aucun jeton d'accès pour un client sans compte : il ne se connectera pas.
  let rawToken: string | null = null;
  if (!noAccount) {
    const generated = generateOpaqueToken();
    rawToken = generated.token;
    await tx.passwordReset.create({
      data: {
        userId: createdUser.id,
        tokenHash: generated.hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
    });
  }

  return {
    dossier: { id: createdDossier.id },
    user: {
      id: createdUser.id,
      email: createdUser.email,
      firstName: createdUser.firstName,
    },
    token: rawToken,
  };
}
