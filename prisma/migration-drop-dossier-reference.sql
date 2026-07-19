-- Migration : suppression du champ Dossier.reference (identifiant humain remplacé
-- par le nom du client dans l'application).
-- Destructif : les références existantes sont perdues. À exécuter AVANT `prisma db push`
-- (après cette migration le schéma est déjà conforme, push ne fait rien).

BEGIN;

DROP INDEX IF EXISTS "Dossier_reference_key";
ALTER TABLE "Dossier" DROP COLUMN IF EXISTS "reference";

COMMIT;
