# Knowledge Extraction

**Work order:** WO-ARGOS-027 (Operational Learning Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change. This document defines a template for what to extract from a resolved `Action`, not a pipeline that extracts it — no summarization job, no scheduled task, no new table.
**Mission:** for every resolved `Action`, what MOVOS can know, and what it should carry forward.

## The five questions, mapped to real fields

Every `Action` row that has reached `RESOLVED` or `DISMISSED` already carries the answer to the first four of these five questions — that is the entire point of the explainability snapshot [OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md) built. The fifth question is the only one that requires judgment beyond what's stored.

### 1. What happened

- **Source:** `Action.title`, `.explanation`, `.evidence` (the `Json` array of evidence bullets), `.severity`, `.recommendationType` — all snapshotted verbatim from the live `ApiRecommendation` at the moment of first interaction, immutable from then on.
- **What's actually captured:** the _symptom_ MOVOS detected and the exact numbers behind it — e.g., for an `ENERGY_ANOMALY`, the recorded average power, the connector's rated power, and the ratio between them (see `getEnergyAnomaly()` in `recommendation.service.ts`), not a vague "something was wrong here."

### 2. What was recommended

- **Source:** `Action.recommendedAction` — also snapshotted, e.g. "Enviar personal técnico a inspeccionar el conector."
- **What's actually captured:** MOVOS's own suggested remedy at the time, frozen — useful specifically because it lets a later reviewer compare the suggestion against what the operator actually did (question 3) without needing to know what the live `RecommendationService` logic looks like today, which may have changed.

### 3. What the operator did

- **Source:** `Action.status` (final value: `RESOLVED` or `DISMISSED`), `Action.assignedToUserName` (final assignee, per [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 5's caveat — only the last assignee is known, not the full handling sequence), `Action.notes` (required, free text, on the terminal transition).
- **What's actually captured:** the _outcome_ of the operator's judgment and, in their own words, why. What's **not** captured: the full sequence of intermediate steps (was it acknowledged for two days before being assigned? snoozed twice first?) — those transitions overwrote each other in place, exactly as [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) named. Knowledge extraction from an `Action` today is extraction from its _final_ state, not its full history.

### 4. Whether it worked

- **Source:** not a field on the `Action` itself — this is the one question answered by looking _across_ rows, not within one. Two things establish it:
  - **Recurrence** (LEARNING_METRICS.md metric 2): did another `Action` for the same `(chargingStationId, recommendationType)` open again after this one closed? If yes, and this one was `RESOLVED`, the fix likely didn't hold.
  - **The operator's own notes**, read qualitatively: an operator who writes "reset firmware, should hold" is making a claim knowledge extraction can later check against recurrence; an operator who writes "reader is old, will need replacing soon" is flagging something no automated check would ever surface on its own.
- **Honest caveat:** "worked" for a `DISMISSED` action means something different — it means the _dismissal_ was correct (the condition really wasn't worth acting on), which is unverifiable without the structured dismiss-reason field named as a gap in [LEARNING_METRICS.md](./LEARNING_METRICS.md) metric 4. Absent that, a dismissed action's "did it work" question can only be answered indirectly: did the same condition keep reappearing and getting dismissed again (suggesting the dismissal was probably right, it really is low-priority noise), or did it eventually escalate into something that had to be resolved instead (suggesting the earlier dismissal was premature)?

### 5. What MOVOS should remember

This is the synthesis step, not a field lookup. For each resolved `Action`, the durable takeaway is one of a small number of shapes:

- **A calibration signal** — this recommendation type's threshold is producing too many/too few actionable results at this org (feeds [LEARNING_METRICS.md](./LEARNING_METRICS.md) metric 3, acceptance rate).
- **A station fact** — this station has now had its Nth `Action`, or its first `HIGH`-severity one, or one that took far longer than typical to resolve (feeds [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md)'s station-level memory).
- **An operator fact** — this person has now resolved several of this recommendation type quickly and cleanly (feeds [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md)'s "best operators" question).
- **A remedy fact** — the free-text note contains an actual root cause or fix MOVOS's own `recommendedAction` text didn't mention (e.g., "reader is old, will need replacing" for a station that keeps producing `AUTH_FAILURE_SPIKE`). This is the one shape of knowledge that is genuinely locked inside unstructured text today, per [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 4's caveat, and the one a future capability would get the most leverage from surfacing.

## What this is not

This is not a proposal for an automated summarization pipeline, an LLM-based note classifier, or a new `Insight`/`Learning` table — any of those would be code, and this work order is discovery only. It is the template such a thing would eventually fill in, and — just as importantly — an honest map of which of the five questions that template can answer from data alone (1, 2, mostly 3) versus which need either a schema addition (4, for dismissals) or actual reading comprehension over free text (5, the remedy-fact case).
