import type { NextAuthConfig } from "next-auth";
import { env } from "@/lib/env";
import { getSettings } from "./lib/settings";

/**
 * Configuration Auth.js v5 partagée — sans accès Prisma/bcrypt.
 * Importable dans tout contexte (proxy.ts notamment).
 *
 * Modèle de session (CDC §3.3) :
 * - JWT en cookie HttpOnly
 * - maxAge global : 7 jours (équivalent refresh token CDC)
 * - updateAge : 1h (rotation du JWT à chaque heure d'activité, équivalent access token CDC)
 * - Timeout d'inactivité : 30 min — invalidation du token dans le callback jwt
 */
export const authConfig = {
  trustHost: env.AUTH_TRUST_HOST,
  secret: env.AUTH_SECRET,
  pages: {
    signIn: "/connexion",
    error: "/connexion",
    signOut: "/deconnexion",
  },
  session: {
    strategy: "jwt",
    maxAge: 3600 * 24 * 30, // 30 jours
    updateAge: 1800, // 30 minutes
  },
  logger: {
    error(error) {
      console.error("[auth][full-error]", error);
    },
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      const inactivityMs =
        (await getSettings()).SESSION_INACTIVITY_MINUTES * 60 * 1000;
      const now = Date.now();

      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastActivity = now;
        token.sessionExpiresAt =
          now +
          (!!user.remember ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000);
        return token;
      }

      const sessionExpiresAt =
        typeof token.sessionExpiresAt === "number"
          ? token.sessionExpiresAt
          : now;

      if (now >= sessionExpiresAt) {
        token.id = undefined;
        token.role = undefined;
        return token;
      }

      const lastActivity =
        typeof token.lastActivity === "number" ? token.lastActivity : now;

      if (now - lastActivity > inactivityMs) {
        token.id = undefined;
        token.role = undefined;
        return token;
      }

      token.lastActivity = now;

      return token;
    },
    async session({ session, token }) {
      const id = typeof token.id === "string" ? token.id : null;
      const role = typeof token.role === "string" ? token.role : null;

      if (id && role) {
        session.user.id = id;
        session.user.role = role as typeof session.user.role;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
