-- CAP-006A (WO-ARGOS-012) Invariant 1: "at most one non-terminal
-- ChargingSession per connector" enforced at the database level, as
-- defense-in-depth behind the advisory-lock serialization added in
-- SessionLifecycleService.createSession / recoverOfflineSession. This is
-- a partial unique index, not representable in Prisma's schema DSL, so it
-- exists only here — same convention as this project's CHECK constraints
-- (see the `add_charging_sessions_foundation` migration).
--
-- The status list mirrors NON_TERMINAL_STATUSES in
-- session-lifecycle.service.ts exactly; if that list ever changes, this
-- index must be updated in the same migration as the code change.
CREATE UNIQUE INDEX "ChargingSession_connectorId_nonterminal_key"
ON "ChargingSession" ("connectorId")
WHERE "status" IN ('PENDING', 'AUTHORIZED', 'STARTING', 'ACTIVE', 'SUSPENDED', 'OFFLINE', 'STOPPING');
