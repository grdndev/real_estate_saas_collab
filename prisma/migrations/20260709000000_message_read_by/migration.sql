-- Remplace la table MessageRead par un champ scalaire readBy (liste des ids
-- des utilisateurs ayant lu le message). Les lectures existantes sont migrées.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "readBy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- DataMigration : reprise des lectures existantes
UPDATE "Message" m
SET "readBy" = sub.users
FROM (
  SELECT "messageId", array_agg("userId") AS users
  FROM "MessageRead"
  GROUP BY "messageId"
) sub
WHERE sub."messageId" = m."id";

-- AlterTable : colonne jamais renseignée (statut de lecture porté par readBy)
ALTER TABLE "Message" DROP COLUMN "readAt";

-- DropTable
DROP TABLE "MessageRead";
