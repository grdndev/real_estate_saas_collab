-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- AlterTable
ALTER TABLE "DocumentRequest" ADD COLUMN     "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING';
