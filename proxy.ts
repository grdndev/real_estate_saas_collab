// Next.js 16 — fichier `proxy.ts` (remplaçant de `middleware.ts`).
// Runtime Node.js. Vérifie session + RBAC avant tout accès aux espaces privés.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess, homePathFor, isPublicRoute } from "@/lib/auth/rbac";

export default auth(function proxy(req) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const session = req.auth;
  if (!session?.user?.id || !session.user.role) {
    const url = new URL("/connexion", req.url);
    if (pathname !== "/") {
      url.searchParams.set("from", pathname);
    }
    // Si la session existe mais sans identité, c'est une expiration d'inactivité.
    if (session?.user) {
      url.searchParams.set("reason", "inactivity");
    }
    return NextResponse.redirect(url);
  }

  if (!canAccess(session.user.role, pathname)) {
    return NextResponse.redirect(
      new URL(homePathFor(session.user.role), req.url),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
