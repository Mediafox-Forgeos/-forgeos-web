-- CreateEnum
CREATE TYPE "BillingAccountType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'FLEET', 'HOA_CONDOMINIUM', 'ROAMING_PARTNER');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "ChargingSession" ADD COLUMN     "billingAccountId" TEXT;

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "BillingAccountType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffSnapshot" (
    "id" TEXT NOT NULL,
    "chargingSessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "energyPricePerKwh" DECIMAL(12,6) NOT NULL,
    "pricePerMinute" DECIMAL(12,6) NOT NULL,
    "fixedFee" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingAccount_organizationId_status_idx" ON "BillingAccount"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TariffSnapshot_chargingSessionId_effectiveAt_idx" ON "TariffSnapshot"("chargingSessionId", "effectiveAt");

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffSnapshot" ADD CONSTRAINT "TariffSnapshot_chargingSessionId_fkey" FOREIGN KEY ("chargingSessionId") REFERENCES "ChargingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffSnapshot" ADD CONSTRAINT "TariffSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
