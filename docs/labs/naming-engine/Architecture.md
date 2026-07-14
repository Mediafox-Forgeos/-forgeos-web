# Naming Engine — Architecture

## Package Boundaries

```
packages/naming-engine/          @mediafox/naming-engine
  src/
    types.ts                     All TypeScript type definitions
    data.ts                      Static phoneme tables, roots, filter lists
    generators.ts                8 generation strategies (including lite web variant)
    scoring.ts                   13 deterministic scoring functions
    filters.ts                   10-stage filter pipeline
    validation.ts                Domain and trademark validation (simulated + live)
    engine.ts                    NamingEngine class (CLI use)
    brand-identity.ts            Deterministic brand kit generation
    web-engine.ts                runWebEngine() — optimized for web requests
    index.ts                     Public API exports

apps/naming-engine-cli/          @mediafox/naming-engine-cli
  src/
    cli.ts                       CLI entry point (imports from package)
    report.ts                    Markdown report generator (imports types from package)

apps/forge-labs/                 @mediafox/forge-labs
  app/naming/                    Naming Engine web UI
  actions/naming.ts              Server Action (runWebEngine wrapper)
  components/naming/             UI components (presentation only)
```

## Dependency Direction

```
apps/forge-labs      →  packages/naming-engine
apps/naming-engine-cli →  packages/naming-engine
packages/naming-engine   (no dependencies on apps)
```

This follows the monorepo rule: packages are consumed by apps, never the reverse.

## Web vs. CLI Modes

| Aspect | CLI (full) | Web (lite) |
| --- | --- | --- |
| Strategy A (Invented) | Full — 510K candidates | Lite — 9K premium candidates |
| Other strategies (B–H) | Full | Full |
| Total candidates | ~570K | ~60K |
| Execution time | 2–5 seconds | 0.5–1 second |
| Top 10 brand identities | Manual (report.ts) | Auto-generated (brand-identity.ts) |
| Report format | Markdown file | JSON response to client |

## Generation Strategies

| ID | Strategy | Web Count |
| --- | --- | ---: |
| A | Invented (lite in web) | ~9,000 |
| B | Latin Roots | ~2,160 |
| C | Greek Roots | ~1,960 |
| D | Phonetic Construction | ~7,040 |
| E | Meaning-First | ~38,400 |
| F | Technology-Style | ~5,040 |
| G | Minimal Brands | ~5,100 |
| H | One-Word Seeds | ~162 |

## Scoring Architecture

All scoring is deterministic (no randomness, no ML). Same input always produces the same output.

Each scoring function takes the name string and returns a value in 0–100. The final score is a weighted sum of six primary dimensions:

```
final = originality × 0.30
      + brandStrength × 0.20
      + memorability × 0.15
      + pronunciation × 0.15
      + domainAvailability × 0.10
      + trademarkSafety × 0.10
```

The remaining 7 dimensions (globalPronunciation, spanishPronunciation, englishPronunciation, premiumPerception, engineeringPerception, innovationPerception, visualSymmetry) are shown in the UI for analysis but do not affect the final score. This keeps the weighted formula interpretable and the rankings stable.

## Brand Identity Generation

`brand-identity.ts` derives a complete brand kit from the candidate name, strategy, and scores — deterministically, without LLM calls. This includes:

- Pronunciation guides (English and Spanish)
- Etymology (matched against Latin/Greek root tables)
- Core concept and brand story
- 3 tagline candidates
- Logo direction
- 4-color brand palette (mapped from strategy and score profile)
- Investor and engineer perception descriptions
- Trademark risk assessment

## Server Action Pattern

```typescript
// actions/naming.ts
'use server'
export async function generateNames(input: EngineInput): Promise<WebNamingResult> {
  return runWebEngine(input);
}
```

The heavy computation runs on the server. The client receives a complete `WebNamingResult` object. A simulated progress animation runs client-side while awaiting the response, using `useTransition` + `useEffect`.

## Persistence

Sessions are stored in `localStorage` as `forge-labs:session`. The architecture is designed to migrate to PostgreSQL: all session data types are defined in `lib/session.ts`, and the `LabSession` type maps cleanly to a database row.

```typescript
type LabSession = {
  id: string;
  input: EngineInput | null;
  results: WebNamingResult | null;
  founderReviews: Record<string, FounderReviewData>;
  compareSelection: string[];
  createdAt: string;
  updatedAt: string;
};
```
