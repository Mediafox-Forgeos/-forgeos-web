-- WO-ARGOS-059 — Remote Operations / Control Plane Foundation, concurrency
-- guard (scope item 8): "maximum one in-flight remote command per physical
-- target." An app-level check-then-create in RemoteCommandService is the
-- primary, readable guard (a clean ConflictException before ever touching
-- the DB) — this partial unique index is the true race-safe backstop,
-- same create-then-catch-P2002 pattern already established by
-- BillingAccount_one_system_default_per_org (see that migration). Not
-- expressible in schema.prisma's declarative syntax (no partial-index
-- support in this Prisma version) — tracked in raw SQL only, same as that
-- precedent.
--
-- Scoped to connector-scoped commands only ("connectorId" IS NOT NULL) —
-- every command Phase A actually implements (RemoteStart, RemoteStop) is
-- connector-scoped. Station-wide commands (Reset, station-wide
-- ChangeAvailability) are both deferred per ARGOS's WO-058 review and
-- would need a second, station-wide exclusion rule added when either is
-- actually implemented — not built here, since encoding "a station-wide
-- command blocks every connector-scoped one on that station too" needs
-- either a serializable transaction or an advisory lock, not a single
-- index, and building that now for commands that don't exist yet would be
-- exactly the opportunistic scope creep WO-059 explicitly warns against.
CREATE UNIQUE INDEX "RemoteCommand_one_active_per_connector"
  ON "RemoteCommand" ("chargingStationId", "connectorId")
  WHERE "state" IN ('REQUESTED', 'SENT', 'ACCEPTED') AND "connectorId" IS NOT NULL;
