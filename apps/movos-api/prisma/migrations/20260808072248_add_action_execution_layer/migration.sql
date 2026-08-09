-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('ENERGY_ANOMALY', 'AUTH_FAILURE_SPIKE', 'IDLE_CONNECTOR', 'COMPARATIVE_UNDERPERFORMANCE', 'EFFICIENCY_DRIFT');

-- CreateEnum
CREATE TYPE "RecommendationSeverity" AS ENUM ('HIGH', 'MEDIUM');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargingStationId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "RecommendationSeverity" NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Action_organizationId_status_idx" ON "Action"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Action_chargingStationId_recommendationType_idx" ON "Action"("chargingStationId", "recommendationType");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_chargingStationId_fkey" FOREIGN KEY ("chargingStationId") REFERENCES "ChargingStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

