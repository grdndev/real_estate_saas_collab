import type { NextAuthConfig } from "next-auth";
import { env } from "@/lib/env";

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
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS,
    updateAge: env.ACCESS_TOKEN_TTL_SECONDS,
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const inactivityMs = env.SESSION_INACTIVITY_MINUTES * 60 * 1000;
      const now = Date.now();

      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.lastActivity = now;
        return token;
      }

      const last =
        typeof token.lastActivity === "number" ? token.lastActivity : null;

      // Si on n'a jamais vu de timestamp d'activité, on se fie à la maxAge globale.
      if (last && now - last > inactivityMs) {
        // Invalidation : on retire l'identité — le callback session ne pourra
        // plus reconstruire un user.id et le proxy redirigera vers /connexion.
        token.id = undefined;
        token.role = undefined;
        token.lastActivity = now;
        return token;
      }

      // Refresh activité (mais pas à chaque requête : limite à 1× / 60s).
      if (trigger === "update" || !last || now - last > 60_000) {
        token.lastActivity = now;
      }
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
