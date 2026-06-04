// Next.js 16 — fichier `proxy.ts` (remplaçant de `middleware.ts`).
// Runtime Node.js. Vérifie session + RBAC avant tout accès aux espaces privés.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess, homePathFor, isPublicRoute } from "@/lib/auth/rbac";

export default auth(function proxy(req) {
  const { pathname } = req.nextUrl;
  const instance = process.env.HOSTNAME ?? "unknown";
  const host = req.headers.get("host");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedPort = req.headers.get("x-forwarded-port");
  const hasCookie = req.headers.has("cookie");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
  const hasAuthSessionCookie = cookieNames.some(
    (name) =>
      name === "authjs.session-token" ||
      name === "__Secure-authjs.session-token",
  );
  const rsc = req.headers.get("rsc");
  const nextAction = req.headers.get("next-action");

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
