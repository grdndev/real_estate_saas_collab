# ADR 0000 — Cadrage Phase 0

- **Statut :** Validé
- **Date :** 2026-04-29
- **Décideurs :** CEO (validation), Dev senior (revue)

## Contexte

Le CDC v1.0 du 13 avril 2026 décrit une plateforme SaaS multi-rôles pour
Équatis (promotion immobilière). Avant tout code, six points devaient être
arbitrés : volumétrie, hébergement, multi-tenant, signature, intégrations,
timing.

## Décisions

### D1. Hébergement — OVH

- VPS Public Cloud OVH (région SBG ou GRA)
- OVH Managed PostgreSQL
- OVH Object Storage (S3-compatible) pour les fichiers

**Pourquoi :** souveraineté France pour des données personnelles + dossiers
immobiliers privés. Évite Vercel/AWS direct.

### D2. Architecture single-tenant strict

Pas de `tenantId` dans le schéma. Une seule instance Équatis.

**Pourquoi :** pas de revente prévue à d'autres promoteurs. Coût marginal du
multi-tenant non justifié à cette échelle.

**Conséquence :** si revente envisagée plus tard, prévoir 2-3 semaines de
refonte (ajout `tenantId` partout + RLS Postgres).

### D3. Signature électronique — Yousign SES

Niveau **Simple Electronic Signature** (le moins coûteux). Pas d'AES ni QES.

**Pourquoi :** scope volontairement contenu. L'acte authentique reste signé
chez le notaire dans son outil métier (hors plateforme).

### D4. Pas d'intégration externe

Pas de CRM, ERP, comptabilité, ou outil notariat synchronisé. Tout passe par
la plateforme — y compris pour le notaire qui aura un compte direct.

### D5. Stack applicatif

- **Next.js 16** (App Router, Turbopack par défaut)
- **TypeScript strict** (`noUncheckedIndexedAccess`, etc.)
- **React 19.2**
- **Tailwind CSS v4** + design tokens Équatis (#1B2A4A bleu nuit, #0FB8A9 turquoise)
- **Prisma 7** (driver adapter `@prisma/adapter-pg`) + PostgreSQL
- **Auth.js v5** (beta) + Credentials provider + JWT cookie HttpOnly
- **pg-boss** (queue dans Postgres — pas de Redis nécessaire à cette échelle)
- **Zod** pour validation
- **bcryptjs cost 12** pour les mots de passe
- **AES-256-GCM** application-level pour les champs sensibles

### D6. Conventions Next.js 16

Le fichier `middleware.ts` est renommé en **`proxy.ts`** (Next 16). Runtime
Node.js (pas Edge). C'est dans ce fichier que vit le RBAC global.

Les API `cookies()`, `headers()`, `params`, `searchParams` sont **async**
(await obligatoire).

Plus de `next lint` — ESLint CLI directement.

### D7. Modèle de session — interprétation CDC §3.3

Le CDC mentionne « access token 1h + refresh token 7j ». L'implémentation
retenue :

- **Cookie HttpOnly JWT** signé avec `AUTH_SECRET`
- `session.maxAge` = 7 jours (équivalent refresh token)
- `session.updateAge` = 1h (rotation du JWT à chaque heure d'activité)
- `lastActivity` stocké dans le JWT, vérifié dans `proxy.ts` — déconnexion
  au-delà de 30 min d'inactivité (CDC §3.3)

Pas de table de refresh tokens dédiée. Pour révoquer une session, on peut
forcer un changement d'`AUTH_SECRET` (toutes les sessions invalides) ou
implémenter un blacklist DB en Phase 4 si la révocation granulaire devient
critique.

### D8. Estimation Phase 1 → 5

Avec OVH + single-tenant + Yousign simple + pas d'intégration :
**45-55 jours-homme**, soit **10-12 semaines calendaires**.

## Suivi des risques

Voir le tableau des risques dans `docs/risks.md` (à créer en Phase 1.5).

## Références

- CDC Équatis v1.0 — 13 avril 2026
- Documentation Next.js 16 (locale via `node_modules/next/dist/docs/`)
- https://authjs.dev/getting-started (v5 beta)
- https://www.prisma.io/docs (v7)
