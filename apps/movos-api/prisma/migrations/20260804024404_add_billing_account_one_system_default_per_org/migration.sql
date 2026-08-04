-- CAP-009 (WO-ARGOS-017A) — closes a race this hardening pass introduced,
-- not one that existed before it: making ChargingSession.billingAccountId
-- required means SessionLifecycleService.createSession() must now resolve
-- an organization's SYSTEM_DEFAULT BillingAccount at runtime (not only at
-- migration time), via a find-or-create. Two concurrent first-ever
-- sessions for the same brand-new organization could otherwise both find
-- "no SYSTEM_DEFAULT exists yet" and both attempt to create one.
--
-- A partial unique index — not a full @@unique on BillingAccount, which
-- would wrongly forbid an organization from ever having more than one
-- COMPANY/INDIVIDUAL/etc. account — makes that race a detectable,
-- recoverable database error (P2002) instead of a silent duplicate. Not
-- expressible in schema.prisma's declarative syntax for this Prisma
-- version (no partial-index support here); tracked in raw SQL only. See
-- docs/domain/CAP-009_BILLING_ACCOUNT_MODEL.md.
CREATE UNIQUE INDEX "BillingAccount_one_system_default_per_org"
  ON "BillingAccount" ("organizationId")
  WHERE "type" = 'SYSTEM_DEFAULT';
