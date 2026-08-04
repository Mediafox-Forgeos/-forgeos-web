-- CAP-009 (WO-ARGOS-017A) — adds the SYSTEM_DEFAULT BillingAccountType
-- value used by the next migration's backfill. Split into its own
-- migration deliberately: PostgreSQL does not allow a newly added enum
-- value to be referenced by a statement in the same transaction that
-- added it ("unsafe use of new value of enum type"). This migration must
-- be applied, and its transaction committed, before
-- 20260804024402_backfill_and_require_billing_account runs.
ALTER TYPE "BillingAccountType" ADD VALUE 'SYSTEM_DEFAULT';
