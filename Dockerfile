FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund;

# ---
FROM base AS builder

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY . .

RUN npm run db:generate

ENV SKIP_ENV_VALIDATION=1
ENV NEXT_PUBLIC_APP_URL=https://plateforme.equatisimmobilier.fr
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build_only_secret_replace_at_runtime_xxxxxxxxxxxxxxxx
ENV DATA_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

RUN npm run build

# ---
FROM builder AS runner

WORKDIR /app

ENV SKIP_ENV_VALIDATION=0
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public

RUN chown node:node .next

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]