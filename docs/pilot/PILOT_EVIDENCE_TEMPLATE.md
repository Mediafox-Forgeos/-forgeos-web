# Pilot Evidence Template

**Work order:** WO-ARGOS-041
**Purpose:** product evidence — does the loop actually work for real people — not employee surveillance. Collect only what's needed to answer that question.

**What NOT to collect:** no personal information beyond a first name/role (already visible in MOVOS's own UI as the real actor attribution), no unrelated conversation content, no location data beyond the optional arrival-confirmation coordinates the technician already chose to share (or didn't), no screenshots of anything outside the `WorkOrder` itself. If a note about "external/manual communication" would require recording the content of a personal conversation, record only that it happened and roughly why — not a transcript.

## Per resolved `WorkOrder`, capture

| Item                       | Source                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relevant system timestamps | Created / assigned / started / resolved — straight off the real `WorkOrder` record, same as `FIVE_WORK_ORDER_PROTOCOL.md`                                                                                              |
| WorkOrder timeline         | `GET /work-orders/:id/events` — the complete, real, canonical history both operator and technician see                                                                                                                 |
| Actor attribution          | Already present on every event (real name, real timestamp) — nothing extra to add                                                                                                                                      |
| Screenshots (where useful) | The operator's `/work-orders/[id]` and the technician's `/my-work/[id]`, at whatever point tells the story best (assignment, checklist, resolution) — useful for anything visual that a timestamp alone doesn't convey |
| Operator observation       | One or two sentences: did they understand what happened, did the assignment flow work, would they have needed to call anyone                                                                                           |
| Technician observation     | Same, from their side: was the assignment clear, did the checklist make sense, anything that felt like busywork or friction                                                                                            |
| External/manual steps      | From `FIVE_WORK_ORDER_PROTOCOL.md`'s own field — repeated here so the evidence pack is self-contained                                                                                                                  |
| Errors                     | Anything MOVOS itself did wrong — a failed request, a confusing message, a 500, a stuck screen. Real and specific, not "it was slow"                                                                                   |
| Product friction           | Anything that worked but was annoying, unclear, or took more steps than it should have — this is different from an outright error and just as valuable                                                                 |
| Final resolution           | The resolution note, verbatim, plus whether the underlying physical problem was actually confirmed fixed (not just the `WorkOrder`)                                                                                    |

## Format

One short write-up per `WorkOrder`, using the table above as the checklist — a few paragraphs, not a formal report. Five of these, assembled together, are exactly what `PILOT_SUCCESS_CRITERIA.md`'s decision gate will be evaluated against.
