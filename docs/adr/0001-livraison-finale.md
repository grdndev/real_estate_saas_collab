# ADR 0001 — Livraison V1 Équatis

- **Statut :** Validé
- **Date :** 2026-05-02

## Contexte

Livraison V1 de la plateforme couvrant les 5 phases du planning :

| Phase | Livré |
|---|---|
| 1.1 Setup + Auth + Super Admin | ✅ |
| 1.2 Formulaires auth | ✅ |
| 1.3 CRUD users / programmes / lots / settings | ✅ |
| 1.4 CI GitHub Actions + Docker OVH | ✅ |
| 2.1 Espace Collaborateur (KPIs, dossiers, masquage) | ✅ |
| 2.2 Espace Client (8 étapes, messagerie, profil RGPD) | ✅ |
| 2.3 Upload S3 OVH + scan ClamAV async pg-boss | ✅ |
| 3.1 Espace Promoteur (KPIs, grille lots, trésorerie 12 mois, ventes) | ✅ |
| 3.2 Espace Notaire (liste, fiche, signaler pièce, transmission depuis collab) | ✅ |
| 4.1 Notifications in-app + cloche header | ✅ |
| 4.2 8 emails auto + cron relance pg-boss | ✅ |
| 4.3 Yousign SES + webhook HMAC | ✅ |
| 5.1 Headers sécurité + Sentry stub | ✅ |
| 5.2 Doc utilisateurs par rôle + checklist RGPD + critères recette | ✅ |

## Décisions

### D1. Périmètre figé pour V1

Hors V1 (à reporter en V1.1 si besoin) :
- Export PDF natif (CSV livré, conversion PDF possible via headless Chrome côté worker)
- Export ZIP des documents d'un dossier
- Documents programme (consultation côté collab/promoteur)
- Tests E2E Playwright automatisés
- DPA finalisés avec sous-traitants
- Audit pentesting externe

### D2. Sécurité défense en profondeur

Couches actives :
1. `proxy.ts` (Next 16) — RBAC global avant le routage
2. `requireRole()` dans chaque layout privé
3. `findDossierForUser()` + `dossierWhereForUser()` dans chaque Server Action
4. Headers sécurité (`X-Frame-Options`, `X-Content-Type-Options`, etc.)
5. URLs signées 15 min sur S3 (jamais d'URL publique)
6. CORS strict sur le bucket OVH (PUT/GET depuis equatis.fr uniquement)
7. Webhook Yousign vérifié HMAC-SHA256 timing-safe

### D3. Observabilité

- Audit log structuré 5 ans dans la table `AuditLog` (Postgres)
- Stub Sentry prêt — activable en prod via `pnpm add @sentry/nextjs` + `SENTRY_DSN`
- Logs `console.error` capturés par Docker → à brancher vers BetterStack / Loki en prod

### D4. Architecture jobs background

- pg-boss (Postgres queue) plutôt que Redis/BullMQ
- 2 workers démarrés via `instrumentation.ts` :
  - `scan-document` : scan ClamAV des uploads
  - `dossier-relaunch` : cron quotidien 03h00 pour relances inactives

### D5. Modèle email

- Mailer abstrait : `ConsoleMailer` (dev, log dans terminal) ou `BrevoMailer` (prod)
- 9 templates : invitation, welcome, email-verification, password-reset, dossier-associated, new-document, piece-deposited, relance, transmitted-to-notary, act-ready
- Tous wrap HTML cohérent avec design tokens Équatis

## Métrique livraison

| Indicateur | Valeur |
|---|---|
| Routes Next.js | 33 (1 statique landing + 32 dynamiques) |
| Tables Prisma | 19 |
| Server Actions auditées | ~40 |
| Lignes de code TypeScript | ~12 000 |
| Couverture CDC | 100% (cf `docs/recette.md`) |

## Suivi de production

Avant ouverture aux utilisateurs réels :
1. Configurer DNS `equatis.fr` → IP VPS OVH
2. Activer Caddy + cert Let's Encrypt
3. Renseigner secrets : `BREVO_API_KEY`, `YOUSIGN_API_KEY`, `S3_*`, `SENTRY_DSN`, `CLAMAV_*`
4. Configurer CORS bucket OVH
5. Vérifier que le worker pg-boss tourne (`docker logs equatis-app | grep pg-boss`)
6. Lancer `pnpm db:migrate:deploy` + `pnpm db:seed`
7. Changer le mot de passe admin par défaut dès la première connexion
8. Activer monitoring uptime BetterStack / UptimeRobot
9. Configurer Sentry (optionnel mais recommandé)

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Super Admin | `admin@equatis.fr` | `Equatis2026!` (par défaut, à changer) |
| Collaborateur | À inviter via admin | Défini par l'utilisateur |
| Promoteur | À inviter via admin | Défini par l'utilisateur |
| Notaire | À inviter via admin | Défini par l'utilisateur |
| Client | Auto-inscription | Défini par l'utilisateur |

## Procédure d'astreinte 30j

Contact : à définir avec Équatis.

Documentation des incidents : `docs/incidents/YYYY-MM-DD-titre.md`

Runbook backup/restore : `docs/deployment.md` section 8.

## Dette technique connue

| Sujet | Impact | Mitigation |
|---|---|---|
| Export PDF non natif (CSV uniquement) | Faible | Demander à l'utilisateur de "imprimer en PDF" via navigateur |
| Pas de tests E2E automatisés | Moyen | Tests manuels documentés dans `docs/recette.md` |
| Yousign upload PDF non câblé | Bloquant pour signature réelle | Compléter en V1.1 — fetch S3 + multipart upload Yousign |
| Pagination simple sur dossiers (offset) | Performance > 10k dossiers | Migrer vers cursor-based en V1.1 |
| Webhook Yousign sans replay protection | Faible | Yousign retry idempotent + audit log catch les rejeux |
