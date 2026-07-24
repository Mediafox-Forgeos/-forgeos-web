import type { NameScores } from './types.js';
import { SCORE_WEIGHTS } from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const UNIVERSAL_CONSONANTS = new Set([
  'B',
  'D',
  'F',
  'G',
  'K',
  'L',
  'M',
  'N',
  'P',
  'R',
  'S',
  'T',
  'V',
  'Z',
]);
const PREMIUM_OPENERS = new Set([
  'K',
  'V',
  'Z',
  'T',
  'R',
  'N',
  'D',
  'F',
  'S',
  'B',
  'G',
  'P',
  'L',
  'M',
]);

function isVowel(c: string): boolean {
  return VOWELS.has(c.toUpperCase());
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Count alternating consonant-vowel transitions (higher = more pronounceable)
function countAlternations(name: string): number {
  const u = name.toUpperCase();
  let count = 0;
  for (let i = 0; i < u.length - 1; i++) {
    if (isVowel(u[i]) !== isVowel(u[i + 1])) count++;
  }
  return count;
}

// Length of longest consecutive consonant or vowel run
function maxRun(name: string, ofVowels: boolean): number {
  const u = name.toUpperCase();
  let max = 0;
  let cur = 0;
  for (const c of u) {
    if (isVowel(c) === ofVowels) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

// ─── Pronunciation score ──────────────────────────────────────────────────────

export function scorePronunciation(name: string): number {
  let score = 70;

  const len = name.length;
  const consonantRun = maxRun(name, false);
  const vowelRun = maxRun(name, true);
  const alternations = countAlternations(name);

  // Length bonus
  if (len >= 4 && len <= 6) score += 12;
  else if (len === 7) score += 6;

  // Alternation bonus
  score += Math.min(alternations * 3, 15);

  // Penalize hard consonant clusters
  if (consonantRun >= 3) score -= (consonantRun - 2) * 12;
  if (consonantRun >= 2) score -= 4;

  // Penalize vowel runs
  if (vowelRun >= 3) score -= (vowelRun - 2) * 10;

  // Penalize ambiguous digraphs
  const u = name.toUpperCase();
  if (/GH/.test(u)) score -= 8;
  if (/WR/.test(u)) score -= 8;
  if (/KN/.test(u)) score -= 8;
  if (/PH/.test(u)) score -= 4; // common enough but slightly academic

  // Bonus for clean ending (X, K, N, R = crisp)
  const last = u.slice(-1);
  if (['X', 'K', 'N', 'R'].includes(last)) score += 5;

  return clamp(score);
}

// ─── Memorability score ───────────────────────────────────────────────────────

export function scoreMemorability(name: string): number {
  let score = 65;
  const len = name.length;
  const u = name.toUpperCase();

  // Length sweet spot
  if (len >= 5 && len <= 6) score += 15;
  else if (len === 4) score += 10;
  else if (len === 7) score += 5;

  // Premium opener bonus
  if (PREMIUM_OPENERS.has(u[0])) score += 8;

  // Strong terminal bonus (X and K are very memorable)
  const last = u.slice(-1);
  if (last === 'X') score += 10;
  else if (last === 'K') score += 7;
  else if (last === 'N' || last === 'R') score += 4;

  // Uniqueness: rare letter combinations
  if (u.includes('KY') || u.includes('VR') || u.includes('ZY')) score += 6;
  if (u.includes('XO') || u.includes('AX') || u.includes('IX')) score += 4;

  // Penalize if all vowels or all consonants
  const vowelCount = [...u].filter(isVowel).length;
  const ratio = vowelCount / len;
  if (ratio < 0.2 || ratio > 0.7) score -= 10;

  return clamp(score);
}

// ─── Visual symmetry ──────────────────────────────────────────────────────────

export function scoreVisualSymmetry(name: string): number {
  let score = 75;
  const u = name.toUpperCase();

  // Penalize triple+ repeated characters
  if (/(.)\1{2,}/.test(u)) score -= 20;
  // Penalize double repeated characters
  if (/(.)\1/.test(u)) score -= 8;

  // Penalize too many ascenders/descenders together
  const ascenders = [...u].filter((c) => 'BDFHIJKLT'.includes(c)).length;
  const descenders = [...u].filter((c) => 'GJPQY'.includes(c)).length;
  if (ascenders > 3) score -= (ascenders - 3) * 5;
  if (descenders > 2) score -= (descenders - 2) * 5;

  // Bonus for clean all-caps readability
  if (/^[A-Z]+$/.test(u)) score += 5;

  return clamp(score);
}

// ─── Brand strength ───────────────────────────────────────────────────────────

export function scoreBrandStrength(name: string): number {
  let score = 68;
  const u = name.toUpperCase();
  const len = name.length;

  // Premium opener strongly increases brand weight
  if (['K', 'V', 'Z', 'X'].includes(u[0])) score += 12;
  else if (['T', 'R', 'N', 'D'].includes(u[0])) score += 6;

  // Strong terminal
  const last = u.slice(-1);
  if (last === 'X') score += 10;
  else if (last === 'K') score += 8;
  else if (['N', 'R', 'S'].includes(last)) score += 4;

  // Ideal length for brand ownership
  if (len >= 5 && len <= 6) score += 8;
  else if (len === 4) score += 5;

  // Strong consonant clusters create authority
  if (/TR|KR|VR|GR|PR/.test(u)) score += 6;

  return clamp(score);
}

// ─── Global pronunciation ─────────────────────────────────────────────────────

export function scoreGlobalPronunciation(name: string): number {
  let score = 80;
  const u = name.toUpperCase();

  // Penalize non-universal phonemes
  if (u.includes('W')) score -= 10; // absent in many languages
  if (u.includes('TH')) score -= 12; // unique to English
  if (u.includes('NG') && u.indexOf('NG') > 0) score -= 8; // terminal NG varies
  if (u.includes('H') && u.indexOf('H') > 0) score -= 5; // mid-word H tricky in Spanish

  // Universal consonants bonus
  const universalRatio =
    [...u].filter((c) => !isVowel(c) && UNIVERSAL_CONSONANTS.has(c)).length /
    Math.max([...u].filter((c) => !isVowel(c)).length, 1);
  score += Math.round(universalRatio * 15);

  return clamp(score);
}

// ─── Spanish pronunciation ────────────────────────────────────────────────────

export function scoreSpanishPronunciation(name: string): number {
  let score = 78;
  const u = name.toUpperCase();

  // Spanish-friendly: no silent letters, phonetic spelling
  if (/W/.test(u)) score -= 15;
  if (/TH/.test(u)) score -= 15;
  if (/PH/.test(u)) score -= 8; // unusual in Spanish native words
  if (/Y(?=[AEIOU])/.test(u)) score += 5; // Y as consonant is natural in Spanish

  // X is prestigious in Spanish (Mexico, Xavier)
  if (u.includes('X')) score += 6;

  // V and B are equivalent in Spanish — V is fine
  if (u[0] === 'V') score += 4;

  return clamp(score);
}

// ─── English pronunciation ────────────────────────────────────────────────────

export function scoreEnglishPronunciation(name: string): number {
  let score = 78;
  const u = name.toUpperCase();

  // Clear vowel sounds
  if (/[AEIOU]{3,}/.test(u)) score -= 10;

  // Z opener is recognized as premium (Zoom, Zappos effect)
  if (u[0] === 'Z') score += 5;

  // Ambiguous vowel sequences
  if (/[AEIOU]{2}/.test(u)) score -= 3;

  return clamp(score);
}

// ─── Premium perception ────────────────────────────────────────────────────────

export function scorePremiumPerception(name: string): number {
  let score = 68;
  const u = name.toUpperCase();
  const len = name.length;

  // Short premium names feel exclusive
  if (len >= 4 && len <= 6) score += 12;

  // Premium letters in opener: K, V, Z convey prestige
  if (['K', 'V', 'Z'].includes(u[0])) score += 14;

  // Avoid generic-sounding patterns
  if (/TECH|SOFT|DIGI|PLAT|CLOUD/.test(u)) score -= 20;

  // Latin/Greek heritage signals intelligence
  const hasLatinFeel = /[VELKRN]/.test(u[0]) && /[XNRS]/.test(u.slice(-1));
  if (hasLatinFeel) score += 8;

  return clamp(score);
}

// ─── Engineering perception ────────────────────────────────────────────────────

export function scoreEngineeringPerception(name: string): number {
  let score = 68;
  const u = name.toUpperCase();

  // Engineering-associated endings
  if (/[XKS]$/.test(u)) score += 10;

  // Strong consonant presence
  const consonantRatio = [...u].filter((c) => !isVowel(c)).length / u.length;
  if (consonantRatio >= 0.5 && consonantRatio <= 0.7) score += 8;

  // Technical clusters
  if (/TR|KR|AX|IX/.test(u)) score += 6;

  return clamp(score);
}

// ─── Innovation perception ─────────────────────────────────────────────────────

export function scoreInnovationPerception(name: string): number {
  let score = 65;
  const u = name.toUpperCase();

  // Unusual letter combinations feel novel
  if (/KY|VR|ZN|YN/.test(u)) score += 12;
  if (/XO|YX|VX/.test(u)) score += 8;

  // Rare opener
  if (['Z', 'V', 'X'].includes(u[0])) score += 10;
  if (['K'].includes(u[0])) score += 6;

  // Unusual mid-word patterns
  const innerClusters = u.slice(1, -1);
  if (/[ZXKV]/.test(innerClusters)) score += 5;

  return clamp(score);
}

// ─── Originality ─────────────────────────────────────────────────────────────

export function scoreOriginality(
  name: string,
  knownCompanies: Set<string>,
  commonWords: Set<string>,
): number {
  let score = 75;
  const lower = name.toLowerCase();

  // Known company name = major penalty
  if (knownCompanies.has(lower)) score -= 40;

  // Common dictionary word = penalty (still original in new context but less so)
  if (commonWords.has(lower)) score -= 20;

  // Unique consonant combination = bonus
  const u = name.toUpperCase();
  const uniqueConsCombo = u.replace(/[AEIOU]/g, '').slice(0, 3);
  if (['KYN', 'VRX', 'ZNX', 'KRX', 'TRX'].includes(uniqueConsCombo))
    score += 12;

  // Long established words = slight penalty
  const WELL_KNOWN_ROOTS = ['veloc', 'apex', 'nexu', 'flux', 'kron'];
  for (const root of WELL_KNOWN_ROOTS) {
    if (lower.startsWith(root)) {
      score -= 8;
      break;
    }
  }

  return clamp(score);
}

// ─── Domain & trademark (simulation) ─────────────────────────────────────────

export function scoreDomainAvailability(name: string): number {
  const lower = name.toLowerCase();
  // Simulate based on name length and unusual character combinations
  // Short, common-sounding names are more likely to have .com taken
  let base = 80;

  if (name.length <= 4) base -= 15; // 4-letter .com very likely taken
  if (name.length <= 5) base -= 8;

  // Names with X, Z, K endings are less likely to be taken as .com
  if (/[XZK]$/.test(lower)) base += 5;

  // Very invented names have better domain availability
  if (/[ZXKVY]/.test(lower[0]) && name.length >= 5) base += 5;

  return clamp(base);
}

export function scoreTrademarkSafety(
  name: string,
  knownCompanies: Set<string>,
): number {
  const lower = name.toLowerCase();
  let score = 82;

  if (knownCompanies.has(lower)) score = 20;

  // Names very similar to known companies
  for (const known of knownCompanies) {
    if (
      Math.abs(known.length - lower.length) <= 1 &&
      levenshtein(known, lower) <= 1
    ) {
      score -= 30;
      break;
    }
  }

  return clamp(score);
}

// ─── Levenshtein distance ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Final score (weighted) ───────────────────────────────────────────────────

export function calculateFinalScore(scores: Omit<NameScores, 'final'>): number {
  return clamp(
    scores.originality * SCORE_WEIGHTS.originality +
      scores.brandStrength * SCORE_WEIGHTS.brandStrength +
      scores.memorability * SCORE_WEIGHTS.memorability +
      scores.pronunciation * SCORE_WEIGHTS.pronunciation +
      scores.domainAvailability * SCORE_WEIGHTS.domainAvailability +
      scores.trademarkSafety * SCORE_WEIGHTS.trademarkSafety,
  );
}

// ─── Score a single name ──────────────────────────────────────────────────────

export function scoreName(
  name: string,
  knownCompanies: Set<string>,
  commonWords: Set<string>,
): NameScores {
  const pronunciation = scorePronunciation(name);
  const memorability = scoreMemorability(name);
  const visualSymmetry = scoreVisualSymmetry(name);
  const brandStrength = scoreBrandStrength(name);
  const globalPronunciation = scoreGlobalPronunciation(name);
  const spanishPronunciation = scoreSpanishPronunciation(name);
  const englishPronunciation = scoreEnglishPronunciation(name);
  const premiumPerception = scorePremiumPerception(name);
  const engineeringPerception = scoreEngineeringPerception(name);
  const innovationPerception = scoreInnovationPerception(name);
  const originality = scoreOriginality(name, knownCompanies, commonWords);
  const domainAvailability = scoreDomainAvailability(name);
  const trademarkSafety = scoreTrademarkSafety(name, knownCompanies);

  const partial = {
    pronunciation,
    memorability,
    visualSymmetry,
    brandStrength,
    globalPronunciation,
    spanishPronunciation,
    englishPronunciation,
    premiumPerception,
    engineeringPerception,
    innovationPerception,
    originality,
    domainAvailability,
    trademarkSafety,
  };

  return { ...partial, final: calculateFinalScore(partial) };
}
