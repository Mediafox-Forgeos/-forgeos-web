# Kylum Console — Design Principles

**Work order:** WO-ARGOS-030 (Kylum Console Foundation)
**Status:** PRODUCT DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** turn the mission's six adjectives — premium, operational, minimalist, enterprise-grade, AI-native, calm under pressure — into concrete, checkable rules, grounded in MOVOS's real, existing visual system (`apps/movos-web/app/globals.css`, `tailwind.config.ts`), not a new design language invented from scratch.

## The five-second rule, made concrete

The mission states it as a goal; this is what it means as a design constraint:

- The health verdict and every Command Center tile in [KYLUM_CONSOLE_WIREFRAMES.md](./KYLUM_CONSOLE_WIREFRAMES.md) must be legible **without scrolling, without hovering, without clicking**, on a standard desktop viewport — this is a desktop-first product, per the mission's own scope.
- No information required to answer "is my network healthy" may live behind a tooltip, an accordion, a "load more," or a second screen. If a fact needs a click to discover, it is not part of the five-second answer — it belongs in a drill-down, not the primary view.
- **A concrete test:** cover the screen after five seconds and ask "does the operator know if they need to act, and roughly how urgently?" If the answer isn't yes, the hierarchy is wrong, regardless of how the screen looks.

## The six principles, made concrete

### Premium

- Typography carries the interface — a real type scale (already established: MOVOS uses a standard Tailwind scale, not custom per-widget font sizes), generous whitespace between sections, no cramming.
- No gradients, drop shadows, or decorative flourishes added purely for visual effect — every visual element earns its place by carrying information (a status color, a severity badge) or structure (a divider, a card boundary).
- Consistent iconography only — the existing `lucide-react` icon set already used throughout `MovosSidebar` and the operator widgets, never mixed with a second icon library or emoji.

### Operational

- Every screen exists to answer one named question ([KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md)) — nothing is placed on a screen because it's "nice to know," only because it serves that screen's specific question.
- Status leads, charts follow — a number or a colored state is almost always clearer and faster to read than a chart of the same single value; charts are reserved for genuine trends-over-time (Business Overview only, per the avoid-list below).
- Every finding is paired with a next step — a case in Operations Center always has its five real transitions available, never a static "here's a problem" with no way to act on it in the same view.

### Minimalist

- One primary answer per screen, enforced structurally by the IA, not just visually — a screen with two equally-weighted "primary" elements has already violated this principle before any styling decision is made.
- Saturated color is reserved for status meaning only (see the palette below) — everything else (labels, chrome, dividers) uses the existing neutral/muted tokens already defined in `globals.css`.
- No decorative illustration, no marketing copy, no empty-state mascots — an empty state (e.g., "no hay acciones pendientes") is one honest sentence, styled like every other muted-text moment in the product.

### Enterprise-grade

- Predictable, repeated patterns across screens — the same right-side drawer for every drill-down, the same header shape on every primary screen ([KYLUM_CONSOLE_NAVIGATION.md](./KYLUM_CONSOLE_NAVIGATION.md)) — a professional operator should never have to relearn an interaction because they moved to a different screen.
- Information density calibrated for a trained daily user, not a first-time consumer — no oversized "friendly" cards with excess padding around a single number; density should feel closer to a trading terminal or an SRE dashboard than a marketing site.
- White-label-safe by construction — every design decision here uses MOVOS's existing token-based palette (`--movos-blue`, `--movos-cyan`, `--movos-slate`), never a hardcoded Kylum-specific color, consistent with the product's own white-label boundary (`docs/product/MOVOS.md`: all tenant branding isolated to `tenant.ts`).

### AI-native

- **Not** sparkle icons, a chatbot widget, or the word "AI" used as decoration — MOVOS's actual intelligence is the Recommendation Engine and Action Center, and "AI-native" means presenting _that_ well, not adding cosmetic signifiers of AI-ness.
- Every computed judgment shows its evidence in the same view or one click away — exactly what `Action`'s explainability snapshot already guarantees (title, explanation, evidence, recommended action, frozen at creation). A verdict without visible evidence reads as a black box, which is the opposite of what "AI-native" should mean here.
- Confidence is stated honestly, never implied. [LEARNING_METRICS.md](./LEARNING_METRICS.md) already found MOVOS cannot yet measure a recommendation's false-positive rate — so the console must never present a recommendation with a fabricated confidence score or accuracy badge. Silence on an unmeasured claim is more AI-native, not less, than a decorative but meaningless certainty indicator.
- Vocabulary is canonical, not improvised — every status word on screen must match [OPERATIONAL_VOCABULARY.md](./OPERATIONAL_VOCABULARY.md)'s single source of truth (`api-charging-status-badges.tsx`), the same discipline that already prevented one enum value from being shown as two different words on two different screens.

### Calm under pressure

- Status color is used sparingly and only for its actual referent — red (`danger` tone) appears only on a genuinely `FAULTED`/`HIGH`-severity element, never decoratively, never repeated redundantly across a screen for emphasis.
- No pulsing, flashing, or attention-grabbing animation to signal urgency — a static, correctly-colored badge communicates severity without inducing the panic a blinking indicator would; motion is reserved for functional transitions only (a drawer sliding in), and respects `prefers-reduced-motion`.
- The healthy state is the visually quietest state on the console, not a celebrated one — no confetti, no "¡Todo perfecto!" — a calm, muted confirmation is more trustworthy to an operator checking in daily than a loud celebration would be, and is easier to distinguish at a glance from a genuine alert state.

## The real palette this design uses

No new palette is proposed — MOVOS already has one (`apps/movos-web/app/globals.css`), and premium/enterprise-grade design here means using it with discipline, not replacing it:

| Token                                     | Real value                                          | Use                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--movos-blue`                            | `hsl(224 76% 58%)`                                  | Primary brand accent, primary actions                                                                                 |
| `--movos-cyan`                            | `hsl(190 82% 52%)`                                  | Secondary accent, informational state                                                                                 |
| `--movos-slate`                           | `hsl(215 20% 55%)`                                  | Neutral text/chrome                                                                                                   |
| Dark surface                              | `#0a1020` (the sidebar's existing background)       | Base ground for a calm, low-glare, "always-on command center" feel                                                    |
| Status tones (existing `Badge` component) | success / warning / danger / info / muted / neutral | The one and only vocabulary for health/severity state across all four screens — no screen invents a new color meaning |

## The avoid-list, made concrete

The mission names four things to avoid; each becomes a checkable rule:

- **Excessive charts.** Zero charts on Command Center, Network Map, and Operations Center — status, numbers, and lists only. Exactly two simple trend lines on Business Overview, no more. No gauge, donut, or pie chart anywhere — a single number or a short ranked list is clearer than a shape for the same data.
- **Unnecessary menus.** Navigation depth is capped at primary nav plus one drawer level ([KYLUM_CONSOLE_NAVIGATION.md](./KYLUM_CONSOLE_NAVIGATION.md)) — no nested dropdown menus, no multi-level flyouts. The mobile hamburger pattern already in `MovosSidebar` stays mobile-only; desktop nav is always fully visible, never collapsed behind an icon.
- **Consumer-app aesthetics.** No emoji as UI elements, no rounded "friendly" illustration style, no gamification (badges, streaks, points, celebratory copy). Language is operational and precise ("3 acciones abiertas," not "¡Tienes 3 cosas pendientes! 🎉").
- **Visual noise.** No more than one saturated status color visible in any single glance outside of an actual multi-status list (like the map's legend, which is allowed exactly because distinguishing states is its job). Generous whitespace over dense packing whenever the two trade off against each other.

## Why this document is the one that should outlive the sprint

[KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md), [KYLUM_CONSOLE_USER_FLOWS.md](./KYLUM_CONSOLE_USER_FLOWS.md), [KYLUM_CONSOLE_WIREFRAMES.md](./KYLUM_CONSOLE_WIREFRAMES.md), and [KYLUM_CONSOLE_NAVIGATION.md](./KYLUM_CONSOLE_NAVIGATION.md) describe this MVP specifically. This document describes the standard every future screen MOVOS adds to the console should be checked against — including the ones this WO explicitly deferred (billing, technician dispatch, maintenance tickets). When those are eventually built, "does this pass the five-second rule" and "does this stay within the avoid-list" are the same two questions to ask again, not a new set to invent.
