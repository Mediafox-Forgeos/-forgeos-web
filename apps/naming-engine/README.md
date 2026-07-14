# @mediafox/naming-engine

MediaFOX Forge institutional naming engine.

Generates, scores, filters, and ranks brand name candidates using eight independent strategies. Produces a professional Branding Report structured for founder and investor review.

## Architecture

```
src/
  types.ts         — all type definitions and scoring weights
  data.ts          — phoneme tables, Latin/Greek roots, filter lists
  generators.ts    — 8 independent name generation strategies
  scoring.ts       — deterministic scoring algorithms (no randomness)
  filters.ts       — phonetic, dictionary, forbidden-word filter pipeline
  validation.ts    — domain and trademark validation (simulated + live API structure)
  engine.ts        — main pipeline orchestrator
  report.ts        — Markdown report generator
  cli.ts           — CLI entry point
```

## Usage

```bash
# Development
pnpm dev --input example-input.json --output reports/output.md

# With live validation (requires API keys)
LIVE_VALIDATION=true pnpm dev --input example-input.json
```

## Input Schema

See `example-input.json` for a complete example. The `EngineInput` type in `src/types.ts` defines the full schema.

```json
{
  "description": "...",
  "industry": "...",
  "keywords": [],
  "brandPersonality": [],
  "languages": [],
  "lengthConstraints": { "min": 4, "max": 7, "preferred": [5, 6] },
  "forbidden": { "words": [], "suffixes": [] },
  "targetDomains": ["com", "io", "ai", "app"],
  "trademarkJurisdictions": ["USPTO", "EUIPO", "WIPO"]
}
```

## Scoring Weights

| Dimension | Weight |
| --- | ---: |
| Originality | 30% |
| Brand Strength | 20% |
| Memorability | 15% |
| Pronunciation | 15% |
| Domain Availability | 10% |
| Trademark Safety | 10% |

## Reports

Pre-generated reports live in `reports/`.

| Report | Description |
| --- | --- |
| [EV-PLATFORM-BRANDING-REPORT.md](reports/EV-PLATFORM-BRANDING-REPORT.md) | AI SaaS for EV Infrastructure — Winner: **KYNEX** |

## Generation Capacity

On the example input (4–7 letters, standard filters):

| Strategy | Generated |
| --- | ---: |
| A — Invented | ~510,000 |
| B — Latin Roots | ~2,160 |
| C — Greek Roots | ~1,960 |
| D — Phonetic | ~7,040 |
| E — Meaning-First | ~38,400 |
| F — Technology | ~5,040 |
| G — Minimal | ~5,100 |
| H — One-Word | ~162 |
| **Total** | **~570,000** |

## Live Validation

Domain and trademark checks require external API credentials:

| Service | API |
| --- | --- |
| Domain availability | Domainr API or WHOIS |
| USPTO trademark | TESS API |
| EUIPO trademark | TMView API |
| WIPO trademark | Brand DB API |
| Web presence | Crunchbase, GitHub, Product Hunt |

Set `LIVE_VALIDATION=true` to enable. Without it, the engine uses heuristic simulation and marks results as `confidence: simulated`.

## Owner

VULCAN — Lead Software Engineer, MediaFOX Forge
