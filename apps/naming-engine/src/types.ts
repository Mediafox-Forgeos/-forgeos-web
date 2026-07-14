// ─── Input ───────────────────────────────────────────────────────────────────

export type LengthConstraints = {
  min: number;
  max: number;
  preferred: [number, number];
};

export type EngineInput = {
  description: string;
  industry: string;
  keywords: string[];
  brandPersonality: string[];
  languages: string[];
  lengthConstraints: LengthConstraints;
  forbidden: {
    words: string[];
    suffixes: string[];
  };
  targetDomains: string[];
  trademarkJurisdictions: string[];
};

// ─── Strategy ────────────────────────────────────────────────────────────────

export type Strategy =
  | 'invented'
  | 'latin'
  | 'greek'
  | 'phonetic'
  | 'meaning'
  | 'technology'
  | 'minimal'
  | 'oneword';

// ─── Scores ──────────────────────────────────────────────────────────────────

export type NameScores = {
  // Component scores (0–100 each)
  pronunciation: number;
  memorability: number;
  visualSymmetry: number;
  brandStrength: number;
  globalPronunciation: number;
  spanishPronunciation: number;
  englishPronunciation: number;
  premiumPerception: number;
  engineeringPerception: number;
  innovationPerception: number;
  originality: number;
  domainAvailability: number;
  trademarkSafety: number;
  // Weighted final score (0–100)
  final: number;
};

// ─── Candidate ───────────────────────────────────────────────────────────────

export type FilterStatus = 'pass' | 'fail';

export type FilterResult = {
  status: FilterStatus;
  reason?: string;
};

export type ValidationResult = {
  domain: Record<string, { available: boolean | null; confidence: 'confirmed' | 'simulated' }>;
  trademark: {
    uspto: { risk: 'low' | 'medium' | 'high' | 'unknown'; confidence: 'simulated' };
    euipo: { risk: 'low' | 'medium' | 'high' | 'unknown'; confidence: 'simulated' };
    wipo: { risk: 'low' | 'medium' | 'high' | 'unknown'; confidence: 'simulated' };
  };
  searchConflicts: {
    crunchbase: boolean | null;
    github: boolean | null;
    productHunt: boolean | null;
    appStore: boolean | null;
  };
  requiresLiveValidation: boolean;
};

export type CandidateName = {
  name: string;
  strategy: Strategy;
  scores: NameScores;
  filterResult: FilterResult;
  validation?: ValidationResult;
};

// ─── Brand Identity ──────────────────────────────────────────────────────────

export type ColorPalette = {
  primary: { hex: string; role: string };
  secondary: { hex: string; role: string };
  accent: { hex: string; role: string };
  semantic: { hex: string; role: string };
};

export type BrandIdentity = {
  name: string;
  score: number;
  rank: number;
  etymology: string;
  meaning: string;
  story: string;
  whyItWorks: string[];
  whyItLost?: string[];
  potentialSlogans: string[];
  logoDirection: string;
  colorPalette: ColorPalette;
  possibleDomains: string[];
  trademarkRisk: 'low' | 'medium' | 'high';
  trademarkNotes: string;
  confidenceLevel: number;
};

// ─── Report ──────────────────────────────────────────────────────────────────

export type GenerationStats = {
  totalGenerated: number;
  byStrategy: Record<Strategy, number>;
  afterLengthFilter: number;
  afterQualityFilter: number;
  afterScoreThreshold: number;
  top100: number;
  top25: number;
  top10: number;
  top3: number;
};

export type BrandingReport = {
  generatedAt: string;
  input: EngineInput;
  stats: GenerationStats;
  top100: Array<{ name: string; score: number; strategy: Strategy; descriptor: string }>;
  top25: Array<{ name: string; score: number; strategy: Strategy; etymology: string; oneLine: string }>;
  top10: CandidateName[];
  top3: BrandIdentity[];
  winner: BrandIdentity & { winnersRationale: string; whyOtherFinalistsLost: string };
};

// ─── Scoring weights (must sum to 1.0) ───────────────────────────────────────

export const SCORE_WEIGHTS = {
  originality: 0.30,
  brandStrength: 0.20,
  memorability: 0.15,
  pronunciation: 0.15,
  domainAvailability: 0.10,
  trademarkSafety: 0.10,
} as const;
