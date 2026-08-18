-- CreateEnum
CREATE TYPE "RemoteCommandType" AS ENUM ('REMOTE_START', 'REMOTE_STOP', 'RESET', 'UNLOCK_CONNECTOR', 'CHANGE_AVAILABILITY');

-- CreateEnum
CREATE TYPE "RemoteCommandState" AS ENUM ('REQUESTED', 'SENT', 'ACCEPTED', 'CONFIRMED', 'REJECTED', 'TIMED_OUT', 'UNCONFIRMED');

-- CreateTable
CREATE TABLE "RemoteCommand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargingStationId" TEXT NOT NULL,
    "connectorId" TEXT,
    "chargingSessionId" TEXT,
    "commandType" "RemoteCommandType" NOT NULL,
    "state" "RemoteCommandState" NOT NULL DEFAULT 'REQUESTED',
    "requestedByUserId" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "protocolMessageId" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RemoteCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteCommand_organizationId_state_idx" ON "RemoteCommand"("organizationId", "state");

-- CreateIndex
CREATE INDEX "RemoteCommand_chargingStationId_state_idx" ON "RemoteCommand"("chargingStationId", "state");

-- CreateIndex
CREATE INDEX "RemoteCommand_chargingStationId_requestedAt_idx" ON "RemoteCommand"("chargingStationId", "requestedAt");

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_chargingSessionId_fkey" FOREIGN KEY ("chargingSessionId") REFERENCES "ChargingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
