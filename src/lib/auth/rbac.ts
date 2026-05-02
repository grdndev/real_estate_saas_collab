import type { UserRole } from "@/generated/prisma/enums";

/**
 * Mapping rôle → préfixe d'URL autorisé. Toute URL hors de cette liste
 * provoque un 403 (cloisonnement strict CDC §2.2).
 */
export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin",
  COLLABORATOR: "/collaborateur",
  PROMOTER: "/promoteur",
  NOTARY: "/notaire",
  CLIENT: "/client",
};

const ROLE_PREFIXES: Record<UserRole, readonly string[]> = {
  SUPER_ADMIN: ["/admin"],
  COLLABORATOR: ["/collaborateur"],
  PROMOTER: ["/promoteur"],
  NOTARY: ["/notaire"],
  CLIENT: ["/client"],
};

/** Routes accessibles à tout user authentifié (profil, déconnexion, etc.). */
const SHARED_AUTHED_PREFIXES = ["/profil", "/deconnexion", "/api/auth"];

/** Routes publiques (pas de session requise). */
export const PUBLIC_ROUTES = [
  "/",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialisation",
  "/confidentialite",
  "/conditions",
  "/verifier-email",
] as const;

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/public",
  "/api/yousign/webhook",
];

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export function canAccess(role: UserRole, pathname: string): boolean {
  if (SHARED_AUTHED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  const allowed = ROLE_PREFIXES[role] ?? [];
  return allowed.some((p) => pathname.startsWith(p));
}

export function homePathFor(role: UserRole): string {
  return ROLE_HOME[role] ?? "/";
}
