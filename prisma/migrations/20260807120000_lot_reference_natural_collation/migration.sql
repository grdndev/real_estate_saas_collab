-- Tri naturel des références de lot, en base (T16).
--
-- Les références mêlent lettres et chiffres (« Lot 2 », « Lot 10 », « A101 »).
-- La collation par défaut les ordonne lexicographiquement : « Lot 10 » avant
-- « Lot 2 ». La collation ICU ci-dessous compare les suites de chiffres comme
-- des nombres (« -u-kn-true »), ce qui donne l'ordre attendu directement dans
-- l'ORDER BY. C'est la condition pour paginer par curseur : sans ordre total
-- côté base, un curseur saute ou duplique des lignes.
--
-- Elle reste déterministe : « Lot 2 » et « Lot 02 » demeurent deux valeurs
-- distinctes — l'unicité (programmeId, reference) est donc inchangée — et les
-- comparaisons LIKE/ILIKE du filtre de recherche restent utilisables, ce qui
-- ne serait pas le cas avec une collation non déterministe.
--
-- Prisma n'exprime pas les collations dans son schéma : cette migration reste
-- du SQL brut, et l'introspection ne la voit pas comme une dérive.

CREATE COLLATION IF NOT EXISTS natural_ref (provider = icu, locale = 'fr-u-kn-true');

-- Réécrit la colonne et reconstruit l'index unique (programmeId, reference).
ALTER TABLE "Lot" ALTER COLUMN "reference" TYPE text COLLATE natural_ref;

-- Support de l'ORDER BY (reference, id) de la pagination par curseur.
CREATE INDEX "Lot_reference_id_idx" ON "Lot" ("reference", "id");
