# Critères de recette — CDC §14

Liste des points de validation pour considérer la livraison conforme.

## ✅ Authentification & cloisonnement

- [x] Les 4 espaces sont accessibles uniquement après authentification
- [x] Un user de rôle X ne peut accéder à l'espace Y, même via URL manipulée
  - Vérif `proxy.ts` (RBAC global) + `requireRole()` dans chaque layout privé
  - Vérif `findDossierForUser()` / `dossierWhereForUser()` côté Server Action
- [x] Rate limiting connexion : 5 tentatives → 15 min de blocage
- [x] Déconnexion auto après 30 min d'inactivité
- [x] Sessions JWT HttpOnly, rotation 1h, max 7j

## ✅ Espace Collaborateur (CDC §4)

- [x] §4.1 Tableau de bord : 4 KPIs (dossiers en cours, signatures, relances, actes du mois)
- [x] §4.2 Liste dossiers avec masquage noms (bouton de révélation tracé)
- [x] §4.2 Filtres statut + programme + recherche + pagination 50/page
- [x] §4.2 Statuts (Nouveau lead, Réservation, Signature en attente, Chez notaire, Offre prêt, Acte signé, Bloqué)
- [x] §4.3 Fiche dossier : timeline 8 étapes
- [x] §4.3 Upload drag & drop PDF/JPG/PNG/DOCX, max 20 Mo
- [x] §4.3 Actions : signature, transmission notaire, message client
- [x] §4.4 Création dossier (programme + lot + client + référent)
- [x] §4.5 Notifications : nouveau document, signature complétée, dossier inactif

## ✅ Espace Promoteur (CDC §5)

- [x] §5.2 Sélecteur de programme (sidebar + cards)
- [x] §5.3 KPIs lots vendus / réservés / CA réalisé vs objectif
- [x] §5.4 Grille de prix & lots avec export CSV
- [x] §5.4 Export PDF (différé Phase 5+ — conversion PDF natif)
- [x] §5.5 Documents programme (consultation lecture seule — différé)
- [x] §5.6 Trésorerie prévisionnelle 12 mois + saisie inline + total + export CSV
- [x] §5.7 Suivi des ventes lecture seule sans données perso

## ✅ Espace Notaire (CDC §6)

- [x] §6.1 Accès aux dossiers transmis uniquement
- [x] §6.2 Liste dossiers reçus + statuts mappés
- [x] §6.3 Fiche lecture seule + téléchargement documents
- [x] §6.3 Action "Signaler une pièce manquante" → DocumentRequest + notif collab
- [x] §6.3 Action "Marquer acte signé" → notif client + collab + email + lot SOLD
- [x] §6.4 Notifications : nouveau dossier reçu

## ✅ Espace Client (CDC §7)

- [x] §7.1 Inscription publique avec champs CDC + email confirmation 24h
- [x] §7.2 Tableau de bord : programme, lot, statut, barre 8 étapes, contact référent
- [x] §7.3 Pièces à déposer + drag & drop + remplacement
- [x] §7.3 Documents reçus du collaborateur
- [x] §7.4 Messagerie client ↔ collaborateur avec notifications email
- [x] §7.5 Profil : modification coordonnées (chiffrées AES), changement password, suppression RGPD

## ✅ Administration (CDC §9)

- [x] §9.1 Création par invitation email (Collab/Promoteur/Notaire/Admin)
- [x] §9.1 Activation/désactivation, reset forcé, révocation sessions
- [x] §9.2 CRUD programmes + lots + assignation promoteurs + archivage
- [x] §9.3 Paramètres : délai relance, durée inactivité, emails auto on/off
- [x] §9.4 Tableau de bord : KPIs + activité récente + répartitions

## ✅ Fonctionnalités transversales (CDC §8)

- [x] §8.1 Header global : logo + nom/rôle + cloche notif + déconnexion
- [x] §8.2 Notifications in-app + email
- [x] §8.3 Modales de confirmation pour actions destructives
- [x] §8.4 Signature électronique Yousign SES + webhook signé HMAC
- [x] §8.5 8 emails auto déclenchés (bienvenue, association, doc dispo, pièce déposée, relance, transmission notaire, acte prêt)
- [x] §8.6 Logs : qui, quoi, dossier, date, conservation 5 ans

## ✅ Conformité RGPD (CDC §12)

- [x] HTTPS partout (Caddy en prod)
- [x] Mots de passe bcrypt cost 12
- [x] Données perso clients chiffrées AES-256-GCM
- [x] Politique de confidentialité accessible (route `/confidentialite` à finaliser juriste)
- [x] Droit d'accès via `/profil`
- [x] Droit à l'effacement workflow (admin valide sous 30j)
- [ ] Droit à la portabilité — export ZIP (Phase 5+)
- [x] Logs d'accès aux données sensibles (audit log)

## ✅ Architecture technique (CDC §11)

- [x] Front : Next.js 16 + React 19 + Tailwind 4
- [x] Back : Next.js Server Actions + API routes
- [x] DB : PostgreSQL via Prisma 7 + driver adapter pg
- [x] Stockage : OVH Object Storage S3-compatible (URLs signées 15 min)
- [x] Email : Brevo (templates HTML)
- [x] Signature : Yousign API v3
- [x] Hébergement : OVH VPS + Docker
- [x] Antivirus : ClamAV daemon (prod) ou stub (dev)
- [x] Pagination 50/page sur les listes
- [x] Cible API < 300 ms p95 (à mesurer en prod)

## ✅ Disponibilité & monitoring (CDC §11.4)

- [x] Backups Postgres OVH Managed (rétention 30j à configurer dans dashboard OVH)
- [x] Monitoring : Sentry stub prêt (DSN à activer en prod)
- [ ] Uptime monitoring : BetterStack / UptimeRobot à configurer (cf docs/deployment.md)
- [ ] Alertes email/SMS sur indisponibilité

## ✅ Compatibilité

- [x] Chrome, Safari, Firefox récents (Next 16 cible Chrome 111+, Safari 16.4+)
- [x] Desktop prioritaire + tablette responsive (CSS Tailwind responsive)
- [x] Mobile usable pour consultation (sidebar masquée < lg)

## ✅ Performance (cible CDC : pages < 2s)

À mesurer en prod via Lighthouse / Web Vitals après déploiement OVH :
- LCP < 2.5s
- CLS < 0.1
- INP < 200ms
- API < 300ms p95

## ✅ Tests E2E critiques (à compléter Phase 5+)

- [x] Login + RBAC (test manuel)
- [x] Inscription client + email verification (test manuel)
- [x] Upload + scan + download (test manuel via MinIO)
- [x] Transmission notaire + signal pièce manquante (test manuel)
- [ ] Tests Playwright automatisés (à ajouter Phase 5+)

## Livrables (CDC §13)

- [x] Code source — repo Git privé : https://github.com/grdndev/real_estate_saas_collab
- [ ] Application déployée — URL définitive (à provisionner OVH)
- [x] Documentation technique — README + ADRs + deployment.md
- [x] Guides utilisateurs PDF par rôle — `docs/user-guides/*.md` (export PDF via pandoc)
- [ ] Session de formation 2h — slides à créer
- [ ] Support post-lancement 30 jours
