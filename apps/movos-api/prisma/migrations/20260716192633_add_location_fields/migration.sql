-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GOOGLE_PLACES', 'GOOGLE_GEOCODING', 'MANUAL', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LocationValidationStatus" AS ENUM ('UNVALIDATED', 'SUGGESTED', 'CONFIRMED', 'PARTIAL', 'INVALID');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "formattedAddress" TEXT,
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "locationSource" "LocationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "locationValidatedAt" TIMESTAMP(3),
ADD COLUMN     "locationValidationStatus" "LocationValidationStatus" NOT NULL DEFAULT 'UNVALIDATED',
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT;
