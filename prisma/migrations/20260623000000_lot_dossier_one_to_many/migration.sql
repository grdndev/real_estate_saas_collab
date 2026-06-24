-- AlterTable: add dossierId to Lot
ALTER TABLE "Lot" ADD COLUMN "dossierId" TEXT;

-- DataMigration: copy existing Dossier.lotId → Lot.dossierId
UPDATE "Lot" l
SET "dossierId" = d.id
FROM "Dossier" d
WHERE d."lotId" = l.id;

-- CreateIndex
CREATE INDEX "Lot_dossierId_idx" ON "Lot"("dossierId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Dossier" DROP CONSTRAINT "Dossier_lotId_fkey";

-- DropColumn
ALTER TABLE "Dossier" DROP COLUMN "lotId";
