-- CAP-009 (WO-ARGOS-017A), Objective 2.
--
-- Domain rule: once the first TariffSnapshot is created for a
-- ChargingSession, that session's currency becomes immutable — every
-- later TariffSnapshot for the same session must use the same currency.
--
-- This is a cross-row rule ("does this new row's currency match every
-- existing sibling row's currency"), which a plain CHECK constraint
-- cannot express (a CHECK only ever evaluates one row in isolation) and
-- which a foreign key cannot express either (there is no natural
-- "parent" row here to reference — see docs/domain/CAP-009_INVARIANTS.md
-- for why a composite-FK-to-ChargingSession.currency design, mirroring
-- Objective 1's tenant-isolation fix, was evaluated and rejected: it
-- requires ChargingSession to already hold the correct currency *before*
-- the first snapshot is inserted, which nothing in this interfaces-only
-- foundation has a way to orchestrate). A trigger is the smallest
-- mechanism that can express "adopt on first use, then enforce" as a
-- single, atomic, self-contained rule.
--
-- This is the first trigger in this schema. It is deliberately scoped as
-- narrowly as possible: one function, one table, one rule, no side
-- effects beyond raising an exception.
CREATE OR REPLACE FUNCTION enforce_tariff_snapshot_currency_consistency()
RETURNS TRIGGER AS $$
DECLARE
  existing_currency TEXT;
BEGIN
  SELECT "currency" INTO existing_currency
  FROM "TariffSnapshot"
  WHERE "chargingSessionId" = NEW."chargingSessionId"
  LIMIT 1;

  IF existing_currency IS NOT NULL AND existing_currency <> NEW."currency" THEN
    RAISE EXCEPTION
      'TariffSnapshot currency mismatch: ChargingSession % already has snapshots in %, cannot add one in %',
      NEW."chargingSessionId", existing_currency, NEW."currency"
      USING ERRCODE = '23514'; -- check_violation, the conventional Postgres code for a domain-rule rejection
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tariff_snapshot_currency_consistency
BEFORE INSERT ON "TariffSnapshot"
FOR EACH ROW
EXECUTE FUNCTION enforce_tariff_snapshot_currency_consistency();
