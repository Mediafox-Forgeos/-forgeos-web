// Types
export type {
  EngineInput,
  LengthConstraints,
  Strategy,
  NameScores,
  FilterResult,
  FilterStatus,
  ValidationResult,
  CandidateName,
  ColorPalette,
  BrandIdentity,
  GenerationStats,
  BrandingReport,
} from './types';
export { SCORE_WEIGHTS } from './types';

// Core engine (CLI use)
export { NamingEngine } from './engine';

// Web engine
export type { WebCandidate, WebCandidateFull, WebNamingResult } from './web-engine';
export { runWebEngine } from './web-engine';

// Brand identity
export type { BrandIdentityFull, BrandColorPalette, BrandColor } from './brand-identity';
export { generateBrandIdentity } from './brand-identity';

// Primitives (for CLI report generation)
export { generateAll, generateAllWeb } from './generators';
export { filterCandidates, applyFilters } from './filters';
export { scoreName, calculateFinalScore } from './scoring';
export { validateName } from './validation';

// Data
export {
  LATIN_ROOTS,
  GREEK_ROOTS,
  KNOWN_COMPANY_NAMES,
  COMMON_ENGLISH_WORDS,
  COMMON_SPANISH_WORDS,
} from './data';
