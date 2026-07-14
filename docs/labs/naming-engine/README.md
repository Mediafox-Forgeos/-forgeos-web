# Naming Engine — Forge Labs

The Naming Engine is the first module of Forge Labs. It generates, scores, filters, and analyzes technology brand names using a deterministic multi-strategy algorithm.

## What It Does

Given a project brief (industry, keywords, constraints), the engine:

1. **Generates** 50,000+ candidate names using 8 parallel strategies
2. **Filters** candidates through a 10-stage phonetic and semantic pipeline
3. **Scores** each candidate across 13 dimensions using weighted algorithms
4. **Validates** top candidates against domain and trademark heuristics
5. **Builds** complete brand identities for the top 10 results

## Using the Web Interface

1. Open Forge Labs → Naming Engine
2. Fill in **Industry** (required) and any **Keywords**
3. Optionally select **Brand Personality**, **Languages**, and advanced constraints
4. Click **Generate Brands** (or press ⌘↵)
5. Wait ~3 seconds while the engine runs

**Results:**
- Left panel updates with top 25 candidates
- Center panel shows generation statistics and the winning name
- Click any candidate card to see full analysis (pronunciation, etymology, brand story, trademark risk, domain availability, score breakdown)
- Use the compare button to analyze 2–5 names side by side
- Use the star button to add a **Founder Score** (5 questions, kept separate from the algorithm score)
- Download individual analysis reports as Markdown

## Score Interpretation

| Score | Interpretation |
| --- | --- |
| 90–100 | Investor-grade brand identity |
| 80–89 | Strong brand candidate |
| 70–79 | Solid functional brand |
| 65–69 | Passes threshold, needs refinement |
| < 65 | Filtered out |

## Scoring Weights

| Dimension | Weight |
| --- | ---: |
| Originality | 30% |
| Brand Strength | 20% |
| Memorability | 15% |
| Pronunciation | 15% |
| Domain Availability | 10% |
| Trademark Safety | 10% |

## CLI Usage

The engine also runs as a CLI for batch processing and investor report generation:

```bash
cd apps/naming-engine
tsx src/cli.ts --input example-input.json --output reports/output.md
```

See `apps/naming-engine/README.md` for full CLI documentation.
