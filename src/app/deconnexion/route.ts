import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { auth } from "@/auth";
import { getRequestContext } from "@/lib/request-context";

/**
 * Route Handler POST pour la déconnexion.
 * Next.js autorise la modification des cookies dans un Route Handler
 * (contrairement à un Server Component de page render).
 */
export async function POST() {
  const session = await auth();
  if (session?.user?.id) {
    const ctx = await getRequestContext();
    await audit({
      userId: session.user.id,
      action: "USER_LOGOUT",
      resourceType: "User",
      resourceId: session.user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: "Déconnexion de la plateforme",
    });
  }
  await signOut({ redirect: false });
  redirect("/connexion?reason=logged_out");
}

export async function GET() {
  redirect("/profil");
}
