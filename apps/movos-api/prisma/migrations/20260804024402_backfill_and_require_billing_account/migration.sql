-- CAP-009 (WO-ARGOS-017A), Objective 1, Option A.
--
-- Closes the mismatch between the approved invariant ("every
-- ChargingSession has exactly one BillingAccount") and the original
-- nullable billingAccountId column. Backfills every existing session with
-- a per-organization SYSTEM_DEFAULT BillingAccount, then makes the column
-- required and replaces the single-column foreign key with a composite
-- one that also enforces tenant isolation.
--
-- Idempotent by construction (every step is guarded by WHERE ... IS NULL /
-- WHERE NOT EXISTS) — safe to re-run if this migration is ever retried
-- after a partial failure.

-- One SYSTEM_DEFAULT BillingAccount per organization that has at least
-- one ChargingSession still missing a billingAccountId. A per-organization
-- account, not one global account: BillingAccount.organizationId is
-- required and this schema enforces hard tenant isolation (DEC-022)
-- throughout — a single global account could never legitimately be
-- referenced by sessions belonging to more than one organization once the
-- composite tenant-isolation foreign key below exists.
--
-- currency defaults to 'USD': no Organization-level currency/locale
-- preference exists anywhere in this schema to derive a better default
-- from (verified: no `currency` or `locale` field on Organization or
-- Site). This is an explicit, honest placeholder — see
-- docs/domain/CAP-009_BILLING_ACCOUNT_MODEL.md.
INSERT INTO "BillingAccount" (
  "id", "organizationId", "type", "displayName", "status", "currency", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  o."id",
  'SYSTEM_DEFAULT',
  'Default Billing Account (system-created)',
  'ACTIVE',
  'USD',
  now(),
  now()
FROM "Organization" o
WHERE EXISTS (
  SELECT 1 FROM "ChargingSession" cs
  WHERE cs."organizationId" = o."id" AND cs."billingAccountId" IS NULL
);

-- Attach every still-unassigned ChargingSession to its organization's
-- SYSTEM_DEFAULT account.
UPDATE "ChargingSession" cs
SET "billingAccountId" = ba."id"
FROM "BillingAccount" ba
WHERE cs."organizationId" = ba."organizationId"
  AND ba."type" = 'SYSTEM_DEFAULT'
  AND cs."billingAccountId" IS NULL;

-- DropForeignKey (the original, single-column, nullable-default relation)
ALTER TABLE "ChargingSession" DROP CONSTRAINT "ChargingSession_billingAccountId_fkey";

-- AlterTable — safe now: every row has been backfilled above.
ALTER TABLE "ChargingSession" ALTER COLUMN "billingAccountId" SET NOT NULL;

-- CreateIndex — structural, not a natural-key uniqueness rule; exists so
-- the composite foreign key below has a matching (organizationId, id)
-- target to reference. See the schema comment on BillingAccount.
CREATE UNIQUE INDEX "BillingAccount_organizationId_id_key" ON "BillingAccount"("organizationId", "id");

-- AddForeignKey — composite, replacing the single-column one dropped
-- above. Pairing organizationId alongside billingAccountId means Postgres
-- rejects any attempt to assign a BillingAccount belonging to a different
-- organization than the session's own. onDelete: Restrict, not the
-- original SET NULL default — see docs/domain/CAP-009_ARCHIVAL_POLICY.md.
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_organizationId_billingAccountId_fkey" FOREIGN KEY ("organizationId", "billingAccountId") REFERENCES "BillingAccount"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
