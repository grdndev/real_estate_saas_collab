import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  role: UserRole;
  email: string;
  name?: string | null;
}

/**
 * Récupère le user de la session ou redirige vers /connexion.
 * À appeler en haut de chaque Server Component d'une page privée
 * (défense en profondeur — proxy.ts filtre déjà).
 */
export async function requireUser(): Promise<SessionUser> {
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
