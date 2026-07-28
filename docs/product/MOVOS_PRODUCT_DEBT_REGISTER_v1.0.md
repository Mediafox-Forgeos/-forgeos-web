# MOVOS Product Debt Register v1.0

**Generated:** 2026-07-29 (WO-ARGOS-006)
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Tracks known product debt that is real, evidenced, and intentionally deferred — not a general TODO list. Each entry follows the same fixed format so nothing gets lost between missions. New entries should be appended, not interleaved; closed entries are marked **Resolved**, not deleted, so the register stays a true history.

---

## DEBT-001 — Stale links from Sessions/Dashboard into retired mock charger routes

**Status:** Open
**Registered:** 2026-07-29 (WO-ARGOS-006), identified during WO-ARGOS-005's final report

### Affected routes or components

- `apps/movos-web/app/(app)/sessions/[sessionId]/page.tsx:112` — renders `<Link href={\`/chargers/${charger.id}\`}>{charger.name}</Link>` inside the session detail's spec list.
- `apps/movos-web/app/(app)/dashboard/page.tsx:163` (`_dashboard-live.tsx` region, "Sesiones activas" card) — calls `getChargerById(session.chargerId)` and renders the mock charger's `name` as plain text (not a link) inside a dashboard widget.
- Root cause in both cases: `apps/movos-web/app/(app)/sessions/page.tsx` and `.../[sessionId]/page.tsx` still import from `src/data/chargers.ts` (mock fixture), which WO-ARGOS-005 explicitly did not touch — Sessions itself remains 100% mock and was out of that mission's scope.

### Current behavior

- Clicking the charger name/link on a session detail page now lands on `/chargers`, which (as of WO-ARGOS-005) is the real Site-selection gateway — not charger detail, and not an error. The link doesn't 404 or break, but it no longer goes anywhere related to the charger the user clicked.
- The dashboard's "Sesiones activas" widget continues to display a mock charger's name as if it were live operational data, with no link at all (so no broken-navigation symptom there, just a mock-data-as-real-data one).

### User impact

Low-to-moderate. Sessions is already a fully mock screen (no real backend, no `DemoBanner`-independent claim of being real), so a stakeholder evaluating Sessions already knows it's a demo. The concrete impact is: clicking through from a mock session to "see the charger" now leads somewhere real-looking (`/chargers`) but topically disconnected from the specific charger that was clicked, which could read as a broken feature rather than an intentionally-scoped one.

### Recommended correction

Do not fix by re-wiring `/chargers/[id]` to accept mock ids again — that would reintroduce exactly what WO-ARGOS-005 removed. The correct fix is downstream of `ChargingSession` becoming real (see [DEBT dependency](#dependency-on-future-chargingsession-work) below): once a real `ChargingSession` references a real `Evse`/`Connector`, the session detail page's charger link should point at the real EVSE detail route (`/sites/[siteId]/charging-stations/[stationId]/evses/[evseId]`) instead of the retired `/chargers/[id]` pattern. Until then, the lowest-risk interim correction (not performed by this work order, which is documentation-only) would be to make the session-detail charger reference plain text instead of a `Link`, removing the implication that it navigates anywhere meaningful.

### Priority

Low. Explicitly not urgent — Sessions is fully mock, the link doesn't error, and the correct fix is naturally sequenced after `ChargingSession` exists, not before.

### Dependency on future ChargingSession work

Blocked on `ChargingSession` becoming a real, backend-connected entity (see [CAP-003 Architecture Decisions — Decision 7](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary)). Once real sessions reference real EVSEs, this debt resolves naturally as part of that migration rather than needing standalone rework.

### Explicit statement

Mock infrastructure data (`src/data/{stations,chargers,connectors}.ts`) is **not authoritative** for any live operational claim in MOVOS. It remains valid only as demo/fixture content for the still-mock Sessions/Dashboard/Tariffs/Alerts/Reports/Users screens, none of which represent real charging infrastructure state. Any screen or component that reads from these files must not be treated as a source of truth about real `ChargingStation`/`Evse`/`Connector` records — those live exclusively behind the real API (see [CAP-002 Charging Terminology Mapping](../domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md)).
