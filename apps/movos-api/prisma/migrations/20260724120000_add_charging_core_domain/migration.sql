-- CreateEnum
CREATE TYPE "ChargingStationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvseStatus" AS ENUM ('AVAILABLE', 'CHARGING', 'OCCUPIED', 'RESERVED', 'UNAVAILABLE', 'FAULTED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('AVAILABLE', 'CHARGING', 'OCCUPIED', 'RESERVED', 'UNAVAILABLE', 'FAULTED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('CCS2', 'TYPE2', 'CHADEMO');

-- CreateEnum
CREATE TYPE "CurrentType" AS ENUM ('AC', 'DC');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('SINGLE_PHASE', 'THREE_PHASE');

-- CreateTable
CREATE TABLE "ChargingStation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "protocol" TEXT,
    "status" "ChargingStationStatus" NOT NULL DEFAULT 'DRAFT',
    "commissionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargingStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evse" (
    "id" TEXT NOT NULL,
    "chargingStationId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT,
    "status" "EvseStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "maxPowerKw" DOUBLE PRECISION,
    "currentType" "CurrentType",
    "phaseType" "PhaseType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "evseId" TEXT NOT NULL,
    "externalId" TEXT,
    "type" "ConnectorType" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "maxPowerKw" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChargingStation_siteId_code_key" ON "ChargingStation"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Evse_chargingStationId_externalId_key" ON "Evse"("chargingStationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_evseId_externalId_key" ON "Connector"("evseId", "externalId");

-- AddForeignKey
ALTER TABLE "ChargingStation" ADD CONSTRAINT "ChargingStation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evse" ADD CONSTRAINT "Evse_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES "Evse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

