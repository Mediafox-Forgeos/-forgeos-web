import type { EngineInput } from '@mediafox/naming-engine';

export const defaultInput: EngineInput = {
  description: '',
  industry: '',
  keywords: [],
  brandPersonality: ['Modern', 'Premium', 'Global'],
  languages: ['English', 'Spanish'],
  lengthConstraints: { min: 4, max: 7, preferred: [5, 6] },
  forbidden: { words: [], suffixes: [] },
  targetDomains: ['com', 'io', 'ai', 'app'],
  trademarkJurisdictions: ['USPTO', 'EUIPO', 'WIPO'],
};

export const PERSONALITY_OPTIONS = [
  'Modern', 'Premium', 'Engineering', 'Trustworthy',
  'Innovative', 'Minimal', 'Global', 'Bold', 'Human',
] as const;

export const LANGUAGE_OPTIONS = ['English', 'Spanish', 'French', 'German', 'Portuguese'] as const;

export const DOMAIN_OPTIONS = ['com', 'io', 'ai', 'app', 'co', 'dev', 'net'] as const;
