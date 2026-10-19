# Operator Day Map

**Work order:** WO-ARGOS-032 (Product Reality Check)
**Status:** PRODUCT VALIDATION. No code, API, migration, or `schema.prisma` change.
**Mission:** the complete day of a charging-network operator, from first login to the end of the day — every beat marked **Inside MOVOS** (the real, shipped console) or **Outside MOVOS** (something that genuinely happens but the product has no part in today). The gap between those two columns is the real subject of this document, not the narrative itself.

## Why the outside-MOVOS column matters more than it looks

A day map that only describes what the product already does would just be a longer version of [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md). The point of walking the _entire_ day is to find every moment the operator has to leave the product to get real work done — phone calls, WhatsApp messages, spreadsheets — because those moments are exactly where [PRODUCT_GAPS.md](./PRODUCT_GAPS.md)'s priorities should come from, not from a hypothetical feature-request list.

## The day

### 7:45 — Before login

**Outside MOVOS.** The operator checks personal phone messages — overnight WhatsApp from a field technician, or a missed call from a driver who couldn't start a charging session last night. MOVOS has no notification channel that reaches anyone who isn't already looking at the screen (the top bar's notification bell is in-app only); anything that happened overnight is only visible once someone chooses to log in and look. This is the first and most consequential gap of the day, not a minor one — see [PRODUCT_GAPS.md](./PRODUCT_GAPS.md).

### 8:00 — Login, Command Center

**Inside MOVOS.** The health verdict, six metric cards, urgent incidents, and recommendations are all real and current as of this moment ([KYLUM_CONSOLE_VISUAL_GUIDE.md](./KYLUM_CONSOLE_VISUAL_GUIDE.md)). This single screen answers the first real question of the day: is anything already on fire. [FIVE_MINUTE_OPERATOR_SIMULATION.md](./FIVE_MINUTE_OPERATOR_SIMULATION.md) walks this exact moment in detail for a specific bad-morning scenario.

### 8:05–9:00 — Morning triage and case work

**Inside MOVOS.** Anything Command Center flagged gets worked in Operations — acknowledging, self-assigning, reading the evidence behind each recommendation. This is real, functioning software: the state transitions are server-enforced, the explanations are frozen at the moment of interaction, and the operator's own notes become a permanent record.

**Outside MOVOS.** The moment a case needs a technician physically dispatched, the product's involvement ends. There is no technician contact list, no way to send a work order with the case's evidence attached, no confirmation that the right person got the message. The operator picks up a phone or opens a separate messaging app, reads the station name and evidence off the MOVOS screen, and relays it manually. The `Action`'s `assignedToUserId` records that _someone at this organization_ owns the case — not that a specific field technician has been notified, equipped, or is even aware it exists.

### 9:00–12:00 — Steady-state monitoring

**Inside MOVOS.** Periodic glances back at Command Center (Flow A, repeated informally through the morning), occasional drill-down on Network if a number looks off, sessions accruing in the background with no operator action needed for the ordinary case.

**Outside MOVOS.** A driver calls or messages about a charging problem at a specific station. The operator has no way to look up that driver, their vehicle, or their session history by anything the driver would actually give them (a name, a phone number, a license plate) — MOVOS's session data is keyed to internal IDs and credential identifiers, not driver-facing contact information. Cross-referencing a phone call to a real session is manual, approximate work today, not a lookup.

A field technician calls back partway through a job with a clarifying question about the case they were dispatched to. The operator answers from memory or by re-opening the Operations drawer — there's no technician-facing view of the case at all, only the operator-facing one.

### 12:00–13:00 — Lunch

**Neither.** Sessions continue unattended; nothing requires the operator's presence for the network to keep functioning, which is itself evidence the core charging/session infrastructure (CAP-003/004) doesn't depend on anyone watching a screen.

### 13:00–16:00 — Afternoon cases, resolution, and the update problem

**Inside MOVOS.** A field technician finishes the morning's dispatched job and reports back — by phone, since there's no other channel. The operator translates that phone call into a `resolve` transition with a note describing what was actually done. The explainability snapshot survives, but the _chain of custody_ between "technician did the work" and "operator typed a summary of what they were told" is entirely manual and unverified by the product.

**Outside MOVOS.** If a new recommendation appears for a station already mid-repair, nothing in the product knows a technician is already on-site — the operator has to remember or cross-check manually. There's no way to mark a station as "under active maintenance" distinct from its computed health status.

### 16:00–17:00 — Occasional strategic check-in

**Inside MOVOS, rarely.** On a day someone asks "how's the network doing this month," the operator opens Analytics — the one screen [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md) already found is not a daily habit for this persona. Most days, this screen is not opened at all.

### 17:00 — Shift end, and the handoff problem

**Outside MOVOS, entirely.** The charging network keeps operating 24 hours; the operator does not. MOVOS has no shift-management or on-call-rotation concept — no way to hand off open cases to a second operator, no record of who is "on call" tonight, no escalation path if a `HIGH`-severity condition appears at 2 AM. Whatever happens after login ends is invisible to the product until someone logs back in — the same gap named at 7:45, from the other side.

### End of day — reporting

**Outside MOVOS, entirely.** A daily or weekly summary for a manager, an investor update, or an internal record — MOVOS's own `/reports` route has shipped nothing since before the Operator Control Center existed (`docs/product/MOVOS.md`'s own "Known constraints": report generation shows "Próximamente," disabled downloads). Whatever reporting actually happens today is a manual export, a screenshot, or a spreadsheet compiled by hand from what the operator remembers checking during the day — not from the product.

## What this day map found, in one paragraph

MOVOS is genuinely present and useful for exactly the part of the day that happens _at a screen, during business hours, for problems the Recommendation Engine already knows how to detect_. Every moment the job requires reaching a person (a technician, a driver, a manager) or spans outside the operator's own login session (overnight, shift handoff, periodic reporting), the product has no part in it today. That is not a surprising finding — it matches exactly what [PRODUCT_GAPS.md](./PRODUCT_GAPS.md) catalogs — but seeing it laid out across one continuous day, rather than as an abstract list, is the actual value of this exercise.
