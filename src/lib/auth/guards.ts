import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  role: UserRole;
  email: string;
  name?: string | null;
}

async function getRequestMeta() {
  const h = await headers();
  const cookie = h.get("cookie");
  const cookieNames = (cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
  const hasAuthSessionCookie = cookieNames.some(
    (name) =>
      name === "authjs.session-token" ||
      name === "__Secure-authjs.session-token",
  );
  return {
    instance: process.env.HOSTNAME ?? "unknown",
    pid: process.pid,
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    forwardedPort: h.get("x-forwarded-port"),
    origin: h.get("origin"),
    referer: h.get("referer"),
    userAgent: h.get("user-agent"),
    rsc: h.get("rsc"),
    nextAction: h.get("next-action"),
    hasCookie: !!cookie,
    cookieLength: cookie?.length ?? 0,
    cookieCount: cookieNames.length,
    cookieNames,
    hasAuthSessionCookie,
  };
}

/**
 * Récupère le user de la session ou redirige vers /connexion.
 * À appeler en haut de chaque Server Component d'une page privée
 * (défense en profondeur — proxy.ts filtre déjà).
 */
export async function requireUser(): Promise<SessionUser> {
  const reqMeta = await getRequestMeta();
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    redirect("/connexion");
  }
  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name,
  };
}

export async function requireRole(
  role: UserRole | UserRole[],
): Promise<SessionUser> {
  const user = await requireUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role)) {
    redirect("/connexion?reason=forbidden");
  }
  return user;
}
