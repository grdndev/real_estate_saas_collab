# Équatis — Plateforme de coordination immobilière

Plateforme web SaaS multi-rôles pour la promotion immobilière Équatis.
Quatre espaces cloisonnés : **Collaborateurs**, **Promoteurs**, **Notaires**, **Clients**.

> **Phase 1 en cours.** Voir `docs/adr/0000-phase-0-cadrage.md` pour les
> décisions techniques figées.

---

## Pré-requis

| Outil | Version minimale | Vérifier |
|---|---|---|
| Node.js | 20.9 | `node --version` |
| pnpm | 10 | `pnpm --version` |
| Docker (et Docker Compose) | 24+ | `docker --version` |
| OpenSSL | 1.1+ | `openssl version` |

---

## Démarrage local — Première installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier le fichier d'environnement (le .env du dev a déjà été généré
#    avec des secrets aléatoires lors du scaffold)
cp .env.example .env

# 3. Démarrer Postgres (Docker)
docker compose up -d postgres

# 4. Générer le client Prisma puis créer le schéma
pnpm db:generate
pnpm db:push       # première fois — sans migration
# ou
pnpm db:migrate    # crée une migration versionnée (à utiliser dès que le schéma se stabilise)

# 5. Lancer le serveur de développement
pnpm dev
```

Ouvrir http://localhost:3000 — la page d'accueil publique doit s'afficher avec
le titre **« Plateforme de coordination immobilière »**.

---

## Scripts disponibles

| Script | Description |
|---|---|
| `pnpm dev` | Serveur de développement Next.js (Turbopack) |
| `pnpm build` | Build de production |
| `pnpm start` | Démarre le build de production |
| `pnpm lint` | Lint ESLint |
| `pnpm format` | Formatte le code via Prettier |
| `pnpm typecheck` | Vérifie les types TS strict |
| `pnpm test` | Tests unitaires Vitest |
| `pnpm db:generate` | Génère le client Prisma |
| `pnpm db:migrate` | Crée et applique une migration |
| `pnpm db:push` | Pousse le schéma sans migration (dev only) |
| `pnpm db:studio` | Ouvre Prisma Studio |
| `pnpm db:seed` | Seed les données initiales |
| `pnpm db:reset` | Reset complet de la base (destructif) |

---

## Structure du projet

```
equatis/
├── prisma/
│   ├── schema.prisma         # Schéma single-tenant complet (CDC v1.0)
│   └── migrations/
├── src/
│   ├── app/                  # Next.js 16 App Router
│   │   ├── (public)/         # Pages publiques (connexion, inscription, ...)
│   │   ├── admin/            # Espace Super Admin
│   │   ├── collaborateur/    # Espace Collaborateur
│   │   ├── promoteur/        # Espace Promoteur
│   │   ├── notaire/          # Espace Notaire
│   │   ├── client/           # Espace Client
│   │   ├── api/auth/         # Auth.js handlers
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Landing publique
│   │   └── globals.css       # Design tokens Équatis
│   ├── lib/
│   │   ├── env.ts            # Validation Zod des variables d'environnement
│   │   ├── prisma.ts         # Client Prisma singleton (driver adapter pg)
│   │   ├── crypto.ts         # AES-256-GCM pour champs perso
│   │   ├── audit.ts          # Helper logs 5 ans (CDC §8.6)
│   │   ├── utils.ts          # Helpers communs (cn, maskName, ...)
│   │   └── auth/
│   │       ├── password.ts   # bcrypt cost 12 + check complexité CDC
│   │       └── rbac.ts       # Tableau rôle → URLs autorisées
│   ├── auth.config.ts        # Config Auth.js v5 partagée
│   ├── auth.ts               # Auth.js v5 + Credentials provider
│   ├── generated/prisma/     # Client Prisma 7 (TS source, gitignoré)
│   └── types/next-auth.d.ts  # Augmentation des types Session/JWT
├── proxy.ts                  # Next 16 : RBAC global (anciennement middleware.ts)
├── docker-compose.yml        # Postgres local (ClamAV + MinIO commentés)
├── .env / .env.example       # Variables d'environnement
└── docs/adr/                 # Architecture Decision Records
```

---

## Sécurité — points clés Phase 1

- ✅ **TypeScript strict** (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- ✅ **bcrypt cost 12** pour les mots de passe (CDC §3.4)
- ✅ **AES-256-GCM** pour téléphone + adresse client (CDC §3.4)
- ✅ **Rate limiting** 5 tentatives → blocage 15 min (CDC §3.2)
- ✅ **JWT en cookie HttpOnly** + rotation 1h + max 7j + inactivité 30 min
- ✅ **Cloisonnement RBAC** vérifié dans `proxy.ts` côté serveur (CDC §2.2)
- ✅ **Audit logs** structurés (5 ans) — `lib/audit.ts`

À implémenter en Phase 2-4 :

- ⏳ Antivirus ClamAV à l'upload
- ⏳ URLs signées 15 min sur OVH Object Storage
- ⏳ Webhooks Yousign signés HMAC
- ⏳ Emails transactionnels Brevo
- ⏳ Tests E2E Playwright sur les chemins critiques

---

## Stack technique

Voir [`docs/adr/0000-phase-0-cadrage.md`](docs/adr/0000-phase-0-cadrage.md)
pour les décisions techniques figées en Phase 0 (et leur justification).
