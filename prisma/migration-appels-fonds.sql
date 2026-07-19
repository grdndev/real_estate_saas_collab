-- Migration : AppelFonds passe au niveau Programme, les montants/suivi LR par lot
-- déménagent dans la nouvelle table FondsAppele.
-- Préserve toutes les données existantes. À exécuter AVANT `prisma db push`
-- (après cette migration le schéma est déjà conforme, push ne fait rien).

BEGIN;

-- 1. Nouvelle table FondsAppele (fonds appelés pour un lot)
CREATE TABLE "FondsAppele" (
    "id" TEXT NOT NULL,
    "lotFondsId" TEXT NOT NULL,
    "appelFondsId" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "dateEnvoiLr" TIMESTAMP(3),
    "dateReceptionVirement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FondsAppele_pkey" PRIMARY KEY ("id")
);

-- 2. L'ancienne table AppelFonds (par lot) devient AppelFonds_old
ALTER TABLE "AppelFonds" RENAME TO "AppelFonds_old";
ALTER TABLE "AppelFonds_old" RENAME CONSTRAINT "AppelFonds_pkey" TO "AppelFonds_old_pkey";

-- 3. Nouvelle table AppelFonds (par programme)
CREATE TABLE "AppelFonds" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "datePrevue" TIMESTAMP(3) NOT NULL,
    "pourcentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppelFonds_pkey" PRIMARY KEY ("id")
);

-- 4. Un appel par (programme, numéro) : label non vide prioritaire, puis plus ancien
INSERT INTO "AppelFonds" ("id", "programmeId", "numero", "label", "datePrevue", "pourcentage", "createdAt")
SELECT DISTINCT ON (l."programmeId", a."numero")
       a."id", l."programmeId", a."numero", a."label", a."datePrevue", a."pourcentage", a."createdAt"
FROM "AppelFonds_old" a
JOIN "LotFondsSuivi" l ON l."id" = a."lotFondsId"
ORDER BY l."programmeId", a."numero", (a."label" = '') ASC, a."createdAt" ASC;

-- 5. Les montants/suivi LR par lot deviennent des FondsAppele
INSERT INTO "FondsAppele" ("id", "lotFondsId", "appelFondsId", "montant", "dateEnvoiLr", "dateReceptionVirement", "createdAt")
SELECT a."id" || '_fa', a."lotFondsId", na."id", a."montant", a."dateEnvoiLr", a."dateReceptionVirement", a."createdAt"
FROM "AppelFonds_old" a
JOIN "LotFondsSuivi" l ON l."id" = a."lotFondsId"
JOIN "AppelFonds" na ON na."programmeId" = l."programmeId" AND na."numero" = a."numero";

-- 6. Nettoyage + index/contraintes aux noms Prisma
DROP TABLE "AppelFonds_old";

CREATE UNIQUE INDEX "AppelFonds_programmeId_numero_key" ON "AppelFonds"("programmeId", "numero");
CREATE INDEX "AppelFonds_programmeId_idx" ON "AppelFonds"("programmeId");
CREATE UNIQUE INDEX "FondsAppele_lotFondsId_appelFondsId_key" ON "FondsAppele"("lotFondsId", "appelFondsId");
CREATE INDEX "FondsAppele_appelFondsId_idx" ON "FondsAppele"("appelFondsId");

ALTER TABLE "AppelFonds" ADD CONSTRAINT "AppelFonds_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FondsAppele" ADD CONSTRAINT "FondsAppele_lotFondsId_fkey"
    FOREIGN KEY ("lotFondsId") REFERENCES "LotFondsSuivi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FondsAppele" ADD CONSTRAINT "FondsAppele_appelFondsId_fkey"
    FOREIGN KEY ("appelFondsId") REFERENCES "AppelFonds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
