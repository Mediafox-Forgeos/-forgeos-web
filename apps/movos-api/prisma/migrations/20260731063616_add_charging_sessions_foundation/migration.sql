-- CreateEnum
CREATE TYPE "AuthCredentialType" AS ENUM ('RFID', 'QR', 'APP', 'REMOTE', 'API', 'FLEET', 'PLUG_AND_CHARGE', 'GUEST');

-- CreateEnum
CREATE TYPE "AuthCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AuthAttemptResult" AS ENUM ('ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED', 'UNKNOWN', 'OFFLINE_ACCEPTED');

-- CreateEnum
CREATE TYPE "ChargingSessionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'STARTING', 'ACTIVE', 'SUSPENDED', 'OFFLINE', 'STOPPING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargingSessionTerminationReason" AS ENUM ('NORMAL_COMPLETION', 'CABLE_DISCONNECTED', 'VEHICLE_FULL', 'REMOTE_STOP', 'EMERGENCY_STOP', 'FAULT', 'TIMEOUT', 'POWER_LOSS', 'STATION_REBOOT', 'USER_CANCELLED', 'NETWORK_FAILURE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "AuthorizationCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AuthCredentialType" NOT NULL,
    "externalIdentifier" TEXT NOT NULL,
    "status" "AuthCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargingStationId" TEXT NOT NULL,
    "evseId" TEXT,
    "connectorId" TEXT,
    "authorizationCredentialId" TEXT,
    "presentedIdentifier" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "AuthAttemptResult" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "AuthorizationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "chargingStationId" TEXT NOT NULL,
    "evseId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "authorizationCredentialId" TEXT NOT NULL,
    "protocolVersion" "OcppProtocolVersion" NOT NULL,
    "protocolTransactionId" TEXT NOT NULL,
    "status" "ChargingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "terminationReason" "ChargingSessionTerminationReason",
    "meterStart" INTEGER NOT NULL,
    "meterStop" INTEGER,
    "energyWh" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterValue" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "energyWh" INTEGER NOT NULL,
    "powerW" INTEGER,
    "voltage" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "frequency" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCredential_organizationId_externalIdentifier_key" ON "AuthorizationCredential"("organizationId", "externalIdentifier");

-- CreateIndex
CREATE INDEX "AuthorizationAttempt_chargingStationId_attemptedAt_idx" ON "AuthorizationAttempt"("chargingStationId", "attemptedAt");

-- CreateIndex
CREATE INDEX "AuthorizationAttempt_authorizationCredentialId_idx" ON "AuthorizationAttempt"("authorizationCredentialId");

-- CreateIndex
CREATE INDEX "ChargingSession_organizationId_status_idx" ON "ChargingSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ChargingSession_siteId_status_idx" ON "ChargingSession"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingSession_chargingStationId_protocolTransactionId_key" ON "ChargingSession"("chargingStationId", "protocolTransactionId");

-- CreateIndex
CREATE INDEX "MeterValue_sessionId_timestamp_idx" ON "MeterValue"("sessionId", "timestamp");

-- AddForeignKey
ALTER TABLE "AuthorizationCredential" ADD CONSTRAINT "AuthorizationCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationAttempt" ADD CONSTRAINT "AuthorizationAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationAttempt" ADD CONSTRAINT "AuthorizationAttempt_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationAttempt" ADD CONSTRAINT "AuthorizationAttempt_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES "Evse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationAttempt" ADD CONSTRAINT "AuthorizationAttempt_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationAttempt" ADD CONSTRAINT "AuthorizationAttempt_authorizationCredentialId_fkey" FOREIGN KEY ("authorizationCredentialId") REFERENCES "AuthorizationCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_evseId_fkey" FOREIGN KEY ("evseId") REFERENCES "Evse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_authorizationCredentialId_fkey" FOREIGN KEY ("authorizationCredentialId") REFERENCES "AuthorizationCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterValue" ADD CONSTRAINT "MeterValue_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChargingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: energyWh can never be negative (DEC-016 / WO-ARGOS-009
-- explicit rule) — enforced as a hard DB constraint in addition to the
-- application-layer check in SessionLifecycleService, not as a substitute
-- for it (the service must reject before attempting the write, not rely on
-- the DB to reject it after).
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_energyWh_nonnegative" CHECK ("energyWh" >= 0);

-- Same family of concern as energyWh above: cumulative meter readings can
-- never be negative.
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_meterStart_nonnegative" CHECK ("meterStart" >= 0);
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_meterStop_nonnegative" CHECK ("meterStop" IS NULL OR "meterStop" >= 0);

-- MeterValue.energyWh is a cumulative reading, same non-negative rule.
ALTER TABLE "MeterValue" ADD CONSTRAINT "MeterValue_energyWh_nonnegative" CHECK ("energyWh" >= 0);
