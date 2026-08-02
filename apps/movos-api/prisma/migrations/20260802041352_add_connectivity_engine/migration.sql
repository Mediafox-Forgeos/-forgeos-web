-- CreateEnum
CREATE TYPE "ConnectivityStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "ChargingStation" ADD COLUMN     "connectivityStatus" "ConnectivityStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastConnectedAt" TIMESTAMP(3),
ADD COLUMN     "lastDisconnectedAt" TIMESTAMP(3),
ADD COLUMN     "lastProtocolVersion" "OcppProtocolVersion",
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);
