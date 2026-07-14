import type { EngineInput, Strategy, NameScores } from './types';
import type { ValidationResult } from './types';
import type { BrandIdentityFull } from './brand-identity';
import { generateAllWeb } from './generators';
import { filterCandidates } from './filters';
import { scoreName } from './scoring';
import { validateName } from './validation';
import { generateBrandIdentity } from './brand-identity';
import { KNOWN_COMPANY_NAMES, COMMON_ENGLISH_WORDS, COMMON_SPANISH_WORDS } from './data';

const COMMON_WORDS = new Set([...COMMON_ENGLISH_WORDS, ...COMMON_SPANISH_WORDS]);
const SCORE_THRESHOLD = 65;

export type WebCandidate = {
  name: string;
  score: number;
  strategy: Strategy;
  scores: NameScores;
};

export type WebCandidateFull = WebCandidate & {
  validation: ValidationResult;
  identity: BrandIdentityFull;
};

export type WebNamingResult = {
  generatedAt: string;
  input: EngineInput;
  stats: {
    totalGenerated: number;
    byStrategy: Record<Strategy, number>;
    afterFilters: number;
    aboveThreshold: number;
  };
  top25: WebCandidate[];
  top10: WebCandidateFull[];
  winner: WebCandidateFull | null;
};

export function runWebEngine(input: EngineInput): WebNamingResult {
  const { candidates, byStrategy } = generateAllWeb(input);

  // Build name → strategy map for O(1) lookups
  const nameToStrategy = new Map<string, Strategy>();
  for (const [strategy, names] of Object.entries(byStrategy) as [Strategy, string[]][]) {
    for (const name of names) {
      const key = name.toLowerCase();
      if (!nameToStrategy.has(key)) nameToStrategy.set(key, strategy);
    }
  }

  const strategyStats = Object.fromEntries(
    Object.entries(byStrategy).map(([s, names]) => [s, names.length]),
  ) as Record<Strategy, number>;

  const { passed } = filterCandidates(candidates, input);

  const scored: WebCandidate[] = [];
  for (const name of passed) {
    const strategy = nameToStrategy.get(name.toLowerCase()) ?? 'invented';
    const scores = scoreName(name, KNOWN_COMPANY_NAMES, COMMON_WORDS);
    if (scores.final >= SCORE_THRESHOLD) {
      scored.push({ name, strategy, scores, score: scores.final });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const top25 = scored.slice(0, 25);

  const top10: WebCandidateFull[] = scored.slice(0, 10).map((c) => ({
    ...c,
    validation: validateName(c.name, input.targetDomains),
    identity: generateBrandIdentity(c.name, c.strategy, c.scores),
  }));

  return {
    generatedAt: new Date().toISOString(),
    input,
    stats: {
      totalGenerated: candidates.length,
      byStrategy: strategyStats,
      afterFilters: passed.length,
      aboveThreshold: scored.length,
    },
    top25,
    top10,
    winner: top10[0] ?? null,
  };
}
