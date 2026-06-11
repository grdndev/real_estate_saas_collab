/*
  Warnings:

  - Changed the type of `category` on the `ProgrammeDocument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProgrammeDocumentCategory" AS ENUM ('PLAN', 'PERMIS', 'NOTICE', 'BUDGET', 'ACTE');

-- AlterTable
ALTER TABLE "ProgrammeDocument" DROP COLUMN "category",
ADD COLUMN     "category" "ProgrammeDocumentCategory" NOT NULL;

-- CreateIndex
CREATE INDEX "ProgrammeDocument_programmeId_category_idx" ON "ProgrammeDocument"("programmeId", "category");
