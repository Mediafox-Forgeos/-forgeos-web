-- CreateEnum
CREATE TYPE "OcppProtocolVersion" AS ENUM ('OCPP1_6J', 'OCPP2_0_1');

-- CreateEnum
CREATE TYPE "OcppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "OcppMessageType" AS ENUM ('CALL', 'CALLRESULT', 'CALLERROR');

-- CreateEnum
CREATE TYPE "OcppProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'UNSUPPORTED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "ChargingStation" ADD COLUMN     "ocppIdentity" TEXT,
ADD COLUMN     "ocppProvisionedAt" TIMESTAMP(3),
ADD COLUMN     "ocppRevokedAt" TIMESTAMP(3),
ADD COLUMN     "ocppSecretHash" TEXT,
ADD COLUMN     "ocppSecretRotatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OcppProtocolEvent" (
    "id" TEXT NOT NULL,
    "chargingStationId" TEXT,
    "protocolVersion" "OcppProtocolVersion" NOT NULL,
    "direction" "OcppMessageDirection" NOT NULL,
    "messageType" "OcppMessageType" NOT NULL,
    "action" TEXT,
    "protocolMessageId" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" "OcppProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "processingError" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "OcppProtocolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcppProtocolEvent_chargingStationId_receivedAt_idx" ON "OcppProtocolEvent"("chargingStationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingStation_ocppIdentity_key" ON "ChargingStation"("ocppIdentity");

-- AddForeignKey
ALTER TABLE "OcppProtocolEvent" ADD CONSTRAINT "OcppProtocolEvent_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

