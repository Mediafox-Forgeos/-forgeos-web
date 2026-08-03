-- AlterEnum
ALTER TYPE "MemberRole" ADD VALUE 'FLEET_MANAGER';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "country" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "timezone" TEXT;
