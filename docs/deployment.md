# Déploiement Équatis sur OVH

Guide complet pour mettre la plateforme en production sur un VPS OVH.

## 1. Architecture cible

```
                    ┌──────────────────────────┐
                    │   GitHub Actions (CI)    │
                    │  build → push image GHCR │
                    └────────────┬─────────────┘
                                 │ SSH deploy
                                 ▼
   ┌─────────────────────────────────────────────────┐
   │  VPS OVH Public Cloud (région SBG ou GRA)        │
   │                                                  │
   │  ┌─────────────┐                                 │
   │  │ docker-     │   pull image from GHCR          │
   │  │ compose.    │ ──────────────────►             │
   │  │ prod.yml    │                                 │
   │  └─────┬───────┘                                 │
   │        │                                         │
   │        ▼                                         │
   │  ┌─────────────┐                                 │
   │  │ container   │ ◄──── HTTPS via nginx ou        │
   │  │ equatis-app │       Caddy (reverse proxy)     │
   │  └─────┬───────┘                                 │
   │        │                                         │
   └────────┼─────────────────────────────────────────┘
            │
            ▼
   ┌────────────────────────┐         ┌────────────────────────┐
   │ OVH Managed PostgreSQL │   OU    │ OVH Object Storage     │
   │ (recommandé)           │         │ S3-compatible          │
   └────────────────────────┘         └────────────────────────┘
```

## 2. Prérequis OVH

### a. VPS Public Cloud

| Ressource | Recommandation Phase 1-3 |
|---|---|
| Modèle | **d2-2** (2 vCPU / 4 Go RAM / 50 Go SSD) ≈ 15 €/mois |
| Région | **SBG** (Strasbourg) ou **GRA** (Gravelines) |
| OS | Debian 12 ou Ubuntu 24.04 LTS |
| Réseau | IP publique fixe + DNS pointant vers cette IP |

### b. Base de données — au choix

**Option recommandée :** OVH Managed PostgreSQL Essential
- ≈ 25 €/mois pour la plus petite instance
- Backups automatiques quotidiens 30j (CDC §11.4)
- DATABASE_URL = `postgresql://USER:PASS@host:port/db?sslmode=require`

**Option économique :** Postgres bundled sur le même VPS
- Coût : 0 € en plus
- Backups : à gérer via cron `pg_dump` (script fourni section 6.b)
- DATABASE_URL = `postgresql://equatis:PASS@postgres:5432/equatis`

### c. Stockage fichiers

- **OVH Object Storage** — bucket S3-compatible
  - Endpoint : `https://s3.{region}.io.cloud.ovh.net`
  - Coût : ~ 0,01 €/Go/mois + bande passante

#### Création du bucket OVH

1. Console OVH → **Public Cloud → Object Storage → S3** → Créer un container.
2. Type : **Standard** (privé). Région : la même que le VPS.
3. Nom : `equatis-documents`.
4. Créer un **utilisateur S3** (Public Cloud → Users) et noter l'access key + secret.
5. **CORS — indispensable pour l'upload navigateur direct via URL signée :**
   ```bash
   # Avec mc (MinIO Client) ou aws-cli configurés vers OVH
   cat > cors.json <<'EOF'
   {
     "CORSRules": [
       {
         "AllowedOrigins": ["https://equatis.fr", "https://www.equatis.fr"],
         "AllowedMethods": ["PUT", "GET", "HEAD"],
         "AllowedHeaders": ["*"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
   }
   EOF
   aws --endpoint-url https://s3.gra.io.cloud.ovh.net \
       s3api put-bucket-cors --bucket equatis-documents \
       --cors-configuration file://cors.json
   ```
6. Mettre à jour `.env` du VPS avec `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

### d. Antivirus ClamAV (optionnel mais recommandé pour la prod)

Installer clamav-daemon sur le VPS :
```bash
sudo apt install -y clamav clamav-daemon
sudo systemctl enable --now clamav-freshclam clamav-daemon
# Vérifier que le daemon écoute en TCP sur 3310 (modifier /etc/clamav/clamd.conf si nécessaire)
```
Puis ajouter dans `.env` :
```ini
CLAMAV_HOST="127.0.0.1"
CLAMAV_PORT="3310"
```
Si `CLAMAV_HOST` est vide, le scanner stub renvoie CLEAN automatiquement (à n'utiliser qu'en dev).

## 3. Préparation du VPS (one-time setup)

```bash
ssh root@VPS_IP

# 1. Sécurité de base
adduser equatis
usermod -aG sudo equatis
mkdir -p /home/equatis/.ssh
# (copier votre clé publique dans /home/equatis/.ssh/authorized_keys)
chown -R equatis:equatis /home/equatis/.ssh
chmod 700 /home/equatis/.ssh
chmod 600 /home/equatis/.ssh/authorized_keys

# Désactiver SSH root + auth password
sed -i 's/^#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

# Pare-feu
apt update && apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 2. Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker equatis

# 3. Préparation du dossier de déploiement
mkdir -p /opt/equatis
chown equatis:equatis /opt/equatis
```

Tester la connexion SSH avec le user equatis :

```bash
ssh equatis@VPS_IP
docker --version    # vérification que docker fonctionne sans sudo
```

## 4. Reverse proxy HTTPS (Caddy ou nginx)

### Caddy (le plus simple — TLS auto via Let's Encrypt)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile` :

```caddy
equatis.fr, www.equatis.fr {
    encode zstd gzip
    reverse_proxy localhost:3000
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}
```

```bash
sudo systemctl reload caddy
```

## 5. Configuration .env de production sur le VPS

```bash
ssh equatis@VPS_IP
cd /opt/equatis
nano .env
```

Contenu type — **ne jamais commit ce fichier** :

```ini
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://equatis.fr

# OVH Managed PostgreSQL
DATABASE_URL="postgresql://USER:PASS@HOST:PORT/equatis?sslmode=require"

# Secrets — générer via :
#   openssl rand -base64 32   (AUTH_SECRET)
#   openssl rand -hex 32      (DATA_ENCRYPTION_KEY)
AUTH_SECRET="REMPLIR"
AUTH_TRUST_HOST=true
DATA_ENCRYPTION_KEY="REMPLIR"

ACCESS_TOKEN_TTL_SECONDS=3600
REFRESH_TOKEN_TTL_SECONDS=604800
SESSION_INACTIVITY_MINUTES=30
LOGIN_LOCK_MINUTES=15
LOGIN_MAX_ATTEMPTS=5

# OVH Object Storage S3
S3_ENDPOINT="https://s3.gra.io.cloud.ovh.net"
S3_REGION="gra"
S3_BUCKET="equatis-prod"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."

# Brevo (emails)
BREVO_API_KEY="xkeysib-..."
EMAIL_FROM="no-reply@equatis.fr"
EMAIL_FROM_NAME="Équatis"

# Yousign (Phase 4)
YOUSIGN_API_KEY=""
YOUSIGN_API_URL="https://api.yousign.app/v3"
YOUSIGN_WEBHOOK_SECRET=""

# Sentry (Phase 5)
SENTRY_DSN=""
SENTRY_ENVIRONMENT="production"
```

```bash
chmod 600 .env
```

## 6. Premier déploiement manuel

```bash
ssh equatis@VPS_IP
cd /opt/equatis

# Cloner le repo (uniquement pour avoir docker-compose.prod.yml)
git clone https://github.com/grdndev/real_estate_saas_collab.git .

# Authentification GHCR (Personal Access Token avec scope read:packages)
echo "$GHCR_PAT" | docker login ghcr.io -u $GITHUB_USER --password-stdin

# Pull + run
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f app

# Premier seed (admin initial)
docker compose -f docker-compose.prod.yml exec app \
  node ./node_modules/.bin/tsx prisma/seed.ts
```

## 7. Secrets GitHub Actions

Dans **Settings → Secrets and variables → Actions** du repo :

| Secret | Description |
|---|---|
| `OVH_VPS_HOST` | IP ou hostname du VPS |
| `OVH_VPS_USER` | `equatis` |
| `OVH_VPS_SSH_KEY` | Clé privée SSH (contenu complet, format OpenSSH) |
| `OVH_VPS_PORT` | (optionnel) port SSH si non-22 |
| `OVH_VPS_DEPLOY_PATH` | `/opt/equatis` |
| `OVH_GHCR_USER` | Votre login GitHub (pour `docker login`) |
| `OVH_GHCR_PAT` | PAT avec scope `read:packages` |

Variable d'environnement (pas un secret) :
| Variable | Valeur |
|---|---|
| `PRODUCTION_URL` | `https://equatis.fr` |

## 8. Backups

### a. Postgres OVH Managed
Automatiques. Configurer la rétention dans le dashboard OVH (par défaut 7j, monter à 30j pour CDC §11.4).

### b. Postgres bundled — script cron

`/opt/equatis/backup.sh` :

```bash
#!/bin/bash
set -e
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/equatis/backups
docker compose -f /opt/equatis/docker-compose.prod.yml exec -T postgres \
  pg_dump -U equatis equatis | gzip > /opt/equatis/backups/equatis_$TS.sql.gz
# Conserver 30 jours
find /opt/equatis/backups -name 'equatis_*.sql.gz' -mtime +30 -delete
```

```bash
chmod +x /opt/equatis/backup.sh
crontab -e
# 02:30 chaque jour
30 2 * * * /opt/equatis/backup.sh >> /opt/equatis/backups/cron.log 2>&1
```

## 9. Monitoring

- **Uptime** : créer un check sur https://betteruptime.com (free tier) ou UptimeRobot ciblant `https://equatis.fr/`
- **Logs** : `docker compose logs -f app` ou intégrer Sentry (Phase 5)
- **Alertes** : configurer notifications email/SMS sur le service uptime

## 10. Procédure de rollback rapide

```bash
ssh equatis@VPS_IP
cd /opt/equatis

# Lister les images locales avec leur tag SHA
docker images ghcr.io/grdndev/real_estate_saas_collab

# Repointer sur un SHA précédent
export IMAGE_TAG=ghcr.io/grdndev/real_estate_saas_collab:abc1234
sed -i "s|image:.*|image: $IMAGE_TAG|" docker-compose.override.yml
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d
```

## 11. Récapitulatif coûts mensuels (estimation)

| Poste | Coût mensuel |
|---|---|
| VPS d2-2 | ~ 15 € |
| Postgres OVH Managed Essential | ~ 25 € |
| Object Storage (50 Go) | ~ 0,50 € |
| Domaine .fr | ~ 7 €/an |
| Brevo (jusqu'à 9000 mails/mois) | gratuit |
| Yousign Simple (~ 0,80 €/sig) | variable |
| **Total** | **~ 40-45 € / mois** + signatures |
