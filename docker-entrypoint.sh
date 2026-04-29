#!/bin/sh
set -e

# Exécution des migrations Prisma au démarrage.
# Si DATABASE_URL est manquant, on s'arrête tôt avec un message clair.
if [ -z "${DATABASE_URL}" ]; then
  echo "❌ DATABASE_URL manquant — l'application ne peut pas démarrer." >&2
  exit 1
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "▶ Application des migrations Prisma…"
  ./node_modules/.bin/prisma migrate deploy
  echo "✓ Migrations appliquées"
fi

echo "▶ Démarrage du serveur Next.js sur ${HOSTNAME}:${PORT}…"
exec "$@"
