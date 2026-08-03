import { randomUUID } from "node:crypto";

/**
 * « Client associé » — client qui n'utilisera pas la plateforme (T7).
 *
 * C'est un `User` de rôle CLIENT au statut `NO_ACCOUNT` : associable à un
 * dossier exactement comme un client classique, mais sans accès. Il est exclu
 * de la connexion (`src/auth.ts` refuse tout statut différent d'ACTIVE), des
 * invitations, des relances email, de la messagerie et de l'espace client.
 */

/**
 * Domaine réservé aux adresses de remplissage.
 *
 * `User.email` est obligatoire et unique en base ; un client sans compte peut
 * ne pas avoir d'adresse. On lui attribue alors une adresse technique, jamais
 * affichée et jamais utilisée pour un envoi.
 */
export const NO_ACCOUNT_EMAIL_DOMAIN = "sans-compte.equatis.invalid";

/** Fabrique une adresse technique unique pour un client sans email. */
export function buildPlaceholderEmail(): string {
  return `client-${randomUUID()}@${NO_ACCOUNT_EMAIL_DOMAIN}`;
}

/** Vrai si l'adresse est une adresse technique (donc : pas de vrai email). */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${NO_ACCOUNT_EMAIL_DOMAIN}`));
}

/** Email réellement affichable / envoyable, `null` si adresse technique. */
export function displayableEmail(
  email: string | null | undefined,
): string | null {
  if (!email || isPlaceholderEmail(email)) return null;
  return email;
}

/**
 * Vrai si ce client peut recevoir emails, notifications et invitations.
 * Un client sans compte est silencieux par construction.
 */
export function canBeContactedByEmail(user: {
  status: string;
  email: string;
}): boolean {
  return user.status !== "NO_ACCOUNT" && !isPlaceholderEmail(user.email);
}
