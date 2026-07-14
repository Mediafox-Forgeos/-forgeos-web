# Naming Engine — Future Roadmap

## Short-Term (Next Sprint)

### Live Validation
Replace heuristic simulation with real API calls:

| Service | Integration |
| --- | --- |
| Domain availability | Domainr API or GoDaddy WHOIS API |
| USPTO trademark | TESS search API |
| EUIPO trademark | TMView REST API |
| WIPO trademark | Global Brand DB API |
| Web presence | Crunchbase API, GitHub Search API |

Implementation path:
1. Set `LIVE_VALIDATION=true` env var
2. Add API key configuration (already supported in `validation.ts`)
3. The function signatures and return types are already production-ready

### Session History
Currently sessions are single-slot (last run overwrites previous). Add multi-session support:
- Session list in the sidebar
- Named sessions (e.g. "EV Platform v2")
- Session comparison across different inputs

### PDF Export
Supplement the Markdown download with a full investor-grade PDF report.

## Medium-Term

### Strategy A Reintroduction
The full invented strategy (510K candidates) is excluded from web mode for performance. Options:
1. Run it as a background job and stream incremental results
2. Pre-generate a curated 10K subset indexed by length/pattern
3. Move to a server with higher compute limits (no Vercel function timeout)

### Semantic Scoring
Add LLM-based scoring layers for:
- Cultural associations in target languages
- Brand resonance in the category
- Competitor proximity

Keep as a separate optional dimension — never mix with the deterministic score.

### Multi-Language Input
The engine currently handles English and Spanish phonetics. Add:
- Mandarin phoneme compatibility check
- Arabic compatibility check (left-to-right rendering, phonetic patterns)
- Hindi compatibility

### Name Families
Given a winner (e.g. KYNEX), generate a family of related names for:
- Product lines (KYNEX Flow, KYNEX Edge)
- Sub-brands
- Internal codenames

## Architecture Evolution

### Extract `@mediafox/scoring`
When other Forge Labs modules need scoring capabilities (Risk Analyzer, PRD quality scoring), extract scoring primitives to `packages/scoring/`.

### PostgreSQL Migration
When team collaboration is needed:
1. Create Supabase project
2. Migrate `LabSession` → `naming_sessions` table
3. Add `founder_reviews` table (FK to sessions)
4. Replace `localStorage` with Supabase client in `lib/session.ts`
5. Add user authentication (Supabase Auth)

The data model is already designed for this migration.

### Real-Time Collaboration
Allow multiple founders to review candidates simultaneously:
- Supabase Realtime subscriptions
- Presence indicators
- Shared founder review scores
- Aggregate team score vs. individual scores

## Known Limitations

1. **Trademark validation is simulated.** All trademark risk assessments are heuristic estimates. Do not use for legal decisions without a professional clearance search.

2. **Domain availability is simulated.** `.com` availability in particular is highly unreliable without live WHOIS checks.

3. **Brand story and etymology are generated, not researched.** The Latin/Greek etymologies are best-effort matches from the root tables. Verify before investor-facing use.

4. **No A/B testing framework.** The scoring weights (30/20/15/15/10/10) were set by editorial judgment. A/B testing with founder feedback would improve calibration.

5. **Meaning-first strategy quality varies.** Keyword fragment combinations can produce semantically muddled names. The filter pipeline catches most issues, but human review of top 10 is still recommended.
