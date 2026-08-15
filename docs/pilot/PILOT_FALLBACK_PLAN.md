# Pilot Fallback Plan

**Work order:** WO-ARGOS-041
**Principle:** MOVOS must never be a single point of failure for real operational safety during the pilot. If MOVOS is unavailable, the physical work still happens — exactly the way it happened before the pilot existed — and MOVOS catches up afterward, not the other way around.

## If the frontend (`movos-web.vercel.app`) is unavailable

The operator or technician cannot reach any screen. **Fall back immediately to the pre-pilot process**: a direct call or message between operator and technician, describing the problem and confirming the work, exactly as it worked before this pilot started. Do not wait for the frontend to come back before acting on a real problem.

## If the API (`movos-api-production.up.railway.app`) is unavailable

Same fallback — even if the frontend loads, nothing real will work without the API. Same rule: don't wait, handle it the old way.

## If the technician cannot authenticate

Don't troubleshoot login for more than a couple of minutes if there's a real, time-sensitive problem in front of them. Call the operator, describe the situation, and proceed with the physical work. Login issues get resolved afterward, not in the middle of a real problem.

## How work continues manually

Exactly as it did before MOVOS: a phone call or message from whoever noticed the problem to whoever needs to act on it, and the same physical troubleshooting steps a technician already knows how to do. Nothing about this pilot changes what to actually do to a station — only how it's coordinated and recorded when the coordination layer is available.

## Who records the event afterward

Whoever first regains access to MOVOS — usually the operator, since they typically have access to a workstation, not just a phone — creates or updates the relevant `WorkOrder` retroactively: a `MANUAL` `WorkOrder`, backfilled with what actually happened and when, noted honestly as recorded after the fact (add a comment saying so — the real event timeline shows a real timestamp for when the record was entered either way, and pretending otherwise would undermine exactly the "operator observes the resulting state/history" property this whole engagement built). This keeps the evidence pack (`PILOT_EVIDENCE_TEMPLATE.md`) honest rather than silently missing a real case.

## Distinguishing a MOVOS failure from a charger/infrastructure failure

These are two different things and should never be confused in the pilot record:

- **A MOVOS failure** means the platform itself — the website, the API, login — was unreachable or broken. This is what this document's fallback applies to.
- **A charger/infrastructure failure** means MOVOS is working fine, but the actual physical station is the problem — which is not a fallback scenario at all, it's the normal case this whole pilot exists to test. A station being offline, unresponsive, or damaged is exactly the kind of real problem a `WorkOrder` should be created for, worked, and resolved.

If it's ever unclear which one occurred, the simplest test settles it: can the operator or technician reach `movos-web.vercel.app/login` and see a normal login screen? If yes, MOVOS is fine and the problem is the charger. If no, MOVOS is the problem and this fallback plan applies.

## What this means for the pilot's evidence

Every time this fallback plan is actually used, that's real, valuable evidence for `docs/pilot/PILOT_SUCCESS_CRITERIA.md`'s reliability section (D) — record it in the relevant `WorkOrder`'s "failures/confusion" field (`FIVE_WORK_ORDER_PROTOCOL.md`), not as an embarrassment to omit.
