import type {
  EngineInput,
  CandidateName,
  Strategy,
  GenerationStats,
  BrandingReport,
} from './types';
import { generateAll } from './generators';
import { filterCandidates } from './filters';
import { scoreName } from './scoring';
import { validateName } from './validation';
import { KNOWN_COMPANY_NAMES, COMMON_ENGLISH_WORDS, COMMON_SPANISH_WORDS } from './data';

const COMMON_WORDS = new Set([...COMMON_ENGLISH_WORDS, ...COMMON_SPANISH_WORDS]);
const SCORE_THRESHOLD = 65;

export class NamingEngine {
  constructor(private readonly input: EngineInput) {}

  run(): BrandingReport {
    const { candidates: allCandidates, byStrategy } = generateAll(this.input);
    const totalGenerated = allCandidates.length;
    const generatedByStrategy = Object.fromEntries(
      Object.entries(byStrategy).map(([s, names]) => [s, names.length]),
    ) as Record<Strategy, number>;

    const { passed: filtered } = filterCandidates(allCandidates, this.input);

    const scored: CandidateName[] = filtered.map((name) => {
      const strategy = this.resolveStrategy(name, byStrategy);
      const scores = scoreName(name, KNOWN_COMPANY_NAMES, COMMON_WORDS);
      return { name, strategy, scores, filterResult: { status: 'pass' } };
    });

    const aboveThreshold = scored.filter((c) => c.scores.final >= SCORE_THRESHOLD);
    aboveThreshold.sort((a, b) => b.scores.final - a.scores.final);

    const TOP_FOR_VALIDATION = 50;
    for (const candidate of aboveThreshold.slice(0, TOP_FOR_VALIDATION)) {
      candidate.validation = validateName(candidate.name, this.input.targetDomains);
    }

    const top100 = aboveThreshold.slice(0, 100);
    const top25 = aboveThreshold.slice(0, 25);
    const top10 = aboveThreshold.slice(0, 10);
    const top3 = aboveThreshold.slice(0, 3);

    const stats: GenerationStats = {
      totalGenerated,
      byStrategy: generatedByStrategy,
      afterLengthFilter: filtered.length,
      afterQualityFilter: scored.length,
      afterScoreThreshold: aboveThreshold.length,
      top100: top100.length,
      top25: top25.length,
      top10: top10.length,
      top3: top3.length,
    };

    return {
      generatedAt: new Date().toISOString(),
      input: this.input,
      stats,
      top100: top100.map((c) => ({
        name: c.name,
        score: c.scores.final,
        strategy: c.strategy,
        descriptor: this.oneLineDescriptor(c.name),
      })),
      top25: top25.map((c) => ({
        name: c.name,
        score: c.scores.final,
        strategy: c.strategy,
        etymology: '',
        oneLine: this.oneLineDescriptor(c.name),
      })),
      top10,
      top3: [],
      winner: undefined as never,
    };
  }

  private resolveStrategy(name: string, byStrategy: Record<Strategy, string[]>): Strategy {
    const lower = name.toLowerCase();
    for (const [strategy, names] of Object.entries(byStrategy)) {
      if (names.some((n) => n.toLowerCase() === lower)) return strategy as Strategy;
    }
    return 'invented';
  }

  private oneLineDescriptor(name: string): string {
    const u = name.toUpperCase();
    const last = u.slice(-1);
    if (last === 'X') return 'precision terminal, engineering gravity';
    if (last === 'K') return 'sharp, decisive, memorable';
    if (last === 'N') return 'open, expansive, international';
    if (last === 'R') return 'authority, resonance';
    if (last === 'S') return 'plural confidence, systemic';
    return 'balanced, versatile';
  }
}
