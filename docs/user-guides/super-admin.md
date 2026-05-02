# Guide Super Admin — Équatis

Ce guide accompagne le rôle **Super Admin** dans la prise en main de la plateforme.

## 1. Première connexion

1. Ouvrez https://equatis.fr/connexion
2. Email : `admin@equatis.fr` (par défaut, à personnaliser via `SEED_ADMIN_EMAIL`)
3. Mot de passe initial : fourni par votre installateur — **changez-le immédiatement** via *Mon profil → Mot de passe*

## 2. Inviter les premiers utilisateurs

*Sidebar → Utilisateurs → Inviter un utilisateur*

| Champ | Détail |
|---|---|
| Prénom / Nom | Identité de la personne |
| Email | L'invitation y sera envoyée |
| Rôle | Collaborateur, Promoteur, Notaire ou Super Admin |

L'utilisateur reçoit un email avec un lien de **définition de mot de passe** valable 7 jours. Tant qu'il n'a pas défini son mot de passe, il ne peut pas se connecter.

## 3. Créer un programme

*Sidebar → Programmes → Nouveau programme*

- **Référence** : identifiant interne, ex. `ANTARES`. Caractères alphanumériques uniquement.
- **Objectif CA** (optionnel) : utilisé pour calculer le pourcentage atteint dans le tableau de bord promoteur.

Une fois le programme créé :
1. Ajoutez les **lots** depuis la fiche du programme (référence, surface, étage, type, prix HT, TVA — le TTC est calculé automatiquement).
2. **Assignez les promoteurs** habilités à voir ce programme. Plusieurs promoteurs possibles.

## 4. Gestion des utilisateurs

Depuis la liste des utilisateurs, le menu d'actions par ligne permet de :
- **Forcer une réinitialisation de mot de passe** (envoie un nouvel email + révoque les sessions actives)
- **Révoquer toutes les sessions** (déconnexion immédiate sur tous les appareils)
- **Désactiver / réactiver** le compte

Vous ne pouvez jamais agir sur **votre propre compte** depuis la liste — pour vous déconnecter, utilisez le menu en haut à droite.

## 5. Paramètres globaux

*Sidebar → Paramètres*

- **Délai avant relance automatique (jours)** : le cron de relance auto envoie un email aux collaborateurs des dossiers sans activité depuis ce nombre de jours.
- **Durée d'inactivité avant déconnexion (minutes)** : durée maximale entre deux requêtes avant invalidation de session (CDC §3.3).
- **Activer les emails automatiques** : décocher temporairement coupe les 8 emails déclenchés (utile en cas d'incident SMTP).

## 6. Sécurité — opérations courantes

### En cas de compromission d'un compte
1. Liste des utilisateurs → menu d'actions → **Révoquer les sessions**
2. **Forcer le reset mot de passe**
3. Demander à l'utilisateur de définir un nouveau mot de passe via le lien reçu

### En cas de demande RGPD (droit à l'effacement)
Quand un client clique « Demander la suppression de mon compte » dans son profil, son statut passe à `DELETION_REQUESTED`. Vous voyez la demande dans la liste des utilisateurs (badge rouge).

Pour traiter la demande sous 30 jours :
1. Ouvrir le compte → vérifier les obligations légales (conservation 10 ans pour acte signé)
2. Si validation : suppression manuelle via Prisma Studio (à automatiser en V1.1)

### Audit logs
Les logs sont conservés 5 ans dans la table `AuditLog`. Consultable via Prisma Studio ou requête SQL :
```sql
SELECT * FROM "AuditLog"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;
```

## 7. Tableau de bord

Le dashboard affiche en temps réel :
- Utilisateurs actifs / créés
- Programmes actifs / total
- Dossiers tous statuts confondus
- Activité récente (8 derniers événements audit)
- Répartition utilisateurs par rôle
- Répartition dossiers par statut

## 8. Support

| Problème | Action |
|---|---|
| Un utilisateur ne reçoit pas d'email | Vérifier `BREVO_API_KEY` dans le serveur + tester sur un autre email |
| Upload fichier échoue | Vérifier `S3_*` + bucket OVH accessible + CORS configuré |
| Signature électronique en erreur | Vérifier `YOUSIGN_*` + dashboard Yousign |
| Le cron de relance ne tourne pas | `docker logs equatis-app` — chercher `[pg-boss]` |
