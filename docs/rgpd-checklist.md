# Checklist RGPD — Équatis

Conformité au Règlement Général sur la Protection des Données (CDC §12).

## ✅ Données collectées et finalité

| Donnée | Finalité | Base légale |
|---|---|---|
| Email, prénom, nom | Identification + contact | Exécution du contrat |
| Téléphone, adresse | Acquisition immobilière | Exécution du contrat |
| Mot de passe (hashé) | Authentification | Exécution du contrat |
| Logs IP / user-agent | Sécurité, audit | Intérêt légitime |
| Documents uploadés | Constitution du dossier | Exécution du contrat |
| Messages | Communication | Exécution du contrat |

## ✅ Mesures techniques

- [x] **HTTPS partout** (Caddy/nginx en prod)
- [x] **Mots de passe hachés bcrypt cost 12** (CDC §3.4)
- [x] **Données sensibles chiffrées AES-256-GCM en base** (téléphone + adresse client)
- [x] **URLs signées 15 min** sur S3 (CDC §11.2)
- [x] **Antivirus à l'upload** (ClamAV daemon ou stub dev)
- [x] **Rate limiting** 5 tentatives → 15 min (CDC §3.2)
- [x] **JWT en cookie HttpOnly** + rotation 1h + max 7j + inactivité 30 min
- [x] **Cloisonnement RBAC strict** côté serveur (CDC §2.2)
- [x] **Audit log 5 ans** (CDC §8.6)
- [x] **Aucune donnée perso dans Sentry** (filtre serveur)

## ✅ Droits des personnes

- [x] **Droit d'accès** : page profil affiche les données stockées
- [x] **Droit de rectification** : `/profil` permet la mise à jour
- [x] **Droit à l'effacement** : workflow `requestAccountDeletionAction` → admin valide sous 30j
- [ ] **Droit à la portabilité** : export ZIP des données perso (Phase 5+)
- [x] **Droit d'opposition au traitement** : suppression de compte
- [x] **Politique de confidentialité accessible** : `/confidentialite` (à finaliser)

## ✅ Documentation requise

- [x] Cette checklist (`docs/rgpd-checklist.md`)
- [x] Politique de confidentialité (route `/confidentialite` à finaliser avec un juriste)
- [x] Conditions d'utilisation (route `/conditions` à finaliser)
- [ ] **Registre des traitements** (à tenir par Équatis — fichier interne)
- [ ] **DPA avec sous-traitants** : OVH (hébergement), Brevo (email), Yousign (signature) — à signer

## ✅ Conservation des données

| Donnée | Durée | Justification |
|---|---|---|
| Compte utilisateur actif | Tant que le compte est actif | Service |
| Compte supprimé (soft delete) | 30 jours | Possibilité de réactivation, audit |
| Logs d'audit | 5 ans | Obligation légale (CDC §8.6) |
| Dossiers immobiliers | 10 ans (paramétrable) | Obligation légale immobilière |
| Documents | 10 ans (paramétrable) | Obligation légale immobilière |
| Logs de connexion | 1 an | Sécurité (LoginAttempt + AuditLog) |

## ✅ Notification de violation

En cas de fuite ou de soupçon :
1. **Sous 72h** : notifier la CNIL via téléservice
2. **Sous 72h** : notifier les utilisateurs impactés si risque élevé pour leurs droits
3. Documenter l'incident (date, périmètre, impact, mesures correctives) dans `docs/incidents/`

## ✅ Sous-traitants identifiés (DPA à signer)

| Sous-traitant | Service | Localisation données |
|---|---|---|
| OVH | Hébergement (VPS + Postgres + Object Storage) | France (région SBG ou GRA) |
| Brevo | Emails transactionnels | France |
| Yousign | Signature électronique | France |
| GitHub Container Registry | Stockage images Docker | États-Unis (transferts encadrés) |

## ✅ Cookie / Tracking

- Cookie HttpOnly de session uniquement (pas de tracking marketing)
- Pas de cookie tiers
- Pas de Google Analytics, Plausible, etc. par défaut
- Bannière de consentement non requise (que des cookies fonctionnels)

## Points en attente (V1.1)

- [ ] Export ZIP des données perso (droit à la portabilité)
- [ ] Page `/confidentialite` finalisée par juriste
- [ ] DPA OVH, Brevo, Yousign signés et archivés
- [ ] Registre des traitements à jour (responsable Équatis)
- [ ] Audit pentesting externe (≈ 1500-3000 €)
