# Guide Collaborateur — Équatis

## Accéder à votre espace

1. Recevez l'email d'invitation envoyé par l'admin
2. Cliquez sur **Définir mon mot de passe** (lien valable 7 jours)
3. Choisissez un mot de passe (8 caractères, 1 majuscule, 1 chiffre minimum)
4. Connectez-vous sur https://equatis.fr/connexion

## Tableau de bord

Vue centrée sur **vos** dossiers (CDC §4.2 — vous ne voyez pas ceux d'autres collaborateurs).

4 indicateurs clés :
- **Dossiers en cours** : tous statuts sauf "Acte signé"
- **Signatures en attente** : statut "Signature en attente"
- **Relances à effectuer** : sans activité depuis X jours (paramètre admin)
- **Actes signés ce mois** : compteur du mois civil

## Gérer vos dossiers

### Créer un dossier
*Sidebar → Dossiers → Nouveau dossier*

- **Programme** + **Lot** (optionnel — peut être attribué plus tard)
- **Client** (optionnel — sélectionnez parmi les clients inscrits non encore associés)
- **Note initiale** (optionnel — visible dans la timeline)

À la création, le lot passe automatiquement en RÉSERVÉ.

### Liste des dossiers
Filtres disponibles : statut, programme, recherche par référence ou nom de programme.

**Confidentialité** : les noms clients sont masqués (●●●●). Cliquez sur le nom masqué pour révéler — l'action est tracée dans les logs d'audit.

### Fiche dossier

**Timeline** verticale avec les 8 étapes officielles + les actions tracées.

**Pièces à demander au client** : ajoutez les libellés des documents que le client doit déposer (ex. *Pièce d'identité recto*). Cocher *Obligatoire* pour bloquer le passage à l'étape suivante.

**Documents du dossier** : voir tous les documents déposés, leur statut de scan antivirus, leur source (client / collaborateur). Téléchargez ou supprimez. Vous pouvez aussi partager un document avec le client via la zone d'upload.

**Messagerie** : conversation directe avec le client. Notification email envoyée au destinataire à chaque message.

**Changer le statut** : transitions disponibles selon l'étape actuelle. Le statut "Acte signé" est irréversible (modale de confirmation).

**Transmettre au notaire** : sélection d'un notaire actif + commentaire. Une fois transmis, le notaire reçoit un email + une notification. Le dossier passe en "Chez le notaire".

**Signature électronique** : envoi d'une procédure Yousign SES au client. Suivi du statut en temps réel via webhook.

## Notifications

La cloche en haut à droite affiche les nouvelles activités :
- Nouvelle pièce déposée par un client
- Pièce manquante signalée par le notaire
- Signature complétée
- Acte signé chez le notaire
- Dossier inactif (relance automatique)

## Conseils opérationnels

| Situation | Action |
|---|---|
| Client n'arrive pas à se connecter | Demander à l'admin de forcer un reset password |
| Fichier client refusé (taille / format) | Format max 20 Mo, accepté : PDF, JPG, PNG, DOCX |
| Notaire signale une pièce manquante | Une `Pièce demandée` apparaît automatiquement, marquée `[Demandé par notaire]` |
| Erreur d'envoi Yousign | Vérifier l'email du signataire + son statut actif |

## Sécurité

- **Mot de passe** : changez-le tous les 6 mois (CDC §3.4)
- **Déconnexion automatique** : après 30 min d'inactivité (paramètre admin)
- **Sessions multiples** : possible, mais l'admin peut révoquer toutes vos sessions à tout moment
