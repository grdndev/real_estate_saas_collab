# syntax=docker/dockerfile:1.7
# ============================================================
# Équatis — Image Docker production
# ============================================================
# Multi-stage build :
#   1. base       : Node 20 alpine + corepack pour pnpm + libs nécessaires à Prisma
#   2. deps       : install des dépendances (cache layer)
#   3. builder    : prisma generate + pnpm build (Turbopack standalone)
#   4. runner     : image finale légère, user non-root, prisma CLI inclus
#                   pour les migrations
# ============================================================

ARG NODE_VERSION=20.18.1

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat openssl tini
RUN corepack enable

# -------- 1. deps --------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
# Désactivation des build-scripts pendant install (sera ré-exécuté par prisma generate)
ENV PNPM_DISABLE_BUILD_SCRIPTS=1
RUN pnpm install --frozen-lockfile --prod=false

# -------- 2. builder --------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV AUTH_SECRET="build_only_secret_replace_at_runtime_xxxxxxxxxxxxxxxx"
ENV DATA_ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
RUN pnpm exec prisma generate
RUN pnpm build
# Empaqueter prisma CLI (pour migrate deploy au runtime)
RUN pnpm install --prod=false --no-save prisma@7.8.0 @prisma/adapter-pg pg

# -------- 3. runner --------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone bundle (server.js + node_modules minimal)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma : schema + migrations + generated client + CLI pour migrate deploy
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
# Copier prisma CLI + ses dépendances depuis le builder (chemin résolu par pnpm)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint qui exécute les migrations puis lance le serveur
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# tini comme PID 1 pour gérer SIGTERM proprement
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
