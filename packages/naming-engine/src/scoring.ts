import type { NameScores } from './types';
import { SCORE_WEIGHTS } from './types';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const UNIVERSAL_CONSONANTS = new Set(['B', 'D', 'F', 'G', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'Z']);
const PREMIUM_OPENERS = new Set(['K', 'V', 'Z', 'T', 'R', 'N', 'D', 'F', 'S', 'B', 'G', 'P', 'L', 'M']);

function isVowel(c: string): boolean {
  return VOWELS.has(c.toUpperCase());
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function countAlternations(name: string): number {
  const u = name.toUpperCase();
  let count = 0;
  for (let i = 0; i < u.length - 1; i++) {
    if (isVowel(u[i]) !== isVowel(u[i + 1])) count++;
  }
  return count;
}

function maxRun(name: string, ofVowels: boolean): number {
  const u = name.toUpperCase();
  let max = 0;
  let cur = 0;
  for (const c of u) {
    if (isVowel(c) === ofVowels) { cur++; if (cur > max) max = cur; }
    else cur = 0;
  }
  return max;
}

export function scorePronunciation(name: string): number {
  let score = 70;
  const len = name.length;
  const consonantRun = maxRun(name, false);
  const vowelRun = maxRun(name, true);
  const alternations = countAlternations(name);
  if (len >= 4 && len <= 6) score += 12;
  else if (len === 7) score += 6;
  score += Math.min(alternations * 3, 15);
  if (consonantRun >= 3) score -= (consonantRun - 2) * 12;
  if (consonantRun >= 2) score -= 4;
  if (vowelRun >= 3) score -= (vowelRun - 2) * 10;
  const u = name.toUpperCase();
  if (/GH/.test(u)) score -= 8;
  if (/WR/.test(u)) score -= 8;
  if (/KN/.test(u)) score -= 8;
  if (/PH/.test(u)) score -= 4;
  const last = u.slice(-1);
  if (['X', 'K', 'N', 'R'].includes(last)) score += 5;
  return clamp(score);
}

export function scoreMemorability(name: string): number {
  let score = 65;
  const len = name.length;
  const u = name.toUpperCase();
  if (len >= 5 && len <= 6) score += 15;
  else if (len === 4) score += 10;
  else if (len === 7) score += 5;
  if (PREMIUM_OPENERS.has(u[0])) score += 8;
  const last = u.slice(-1);
  if (last === 'X') score += 10;
  else if (last === 'K') score += 7;
  else if (last === 'N' || last === 'R') score += 4;
  if (u.includes('KY') || u.includes('VR') || u.includes('ZY')) score += 6;
  if (u.includes('XO') || u.includes('AX') || u.includes('IX')) score += 4;
  const vowelCount = [...u].filter(isVowel).length;
  const ratio = vowelCount / len;
  if (ratio < 0.2 || ratio > 0.7) score -= 10;
  return clamp(score);
}

export function scoreVisualSymmetry(name: string): number {
  let score = 75;
  const u = name.toUpperCase();
  if (/(.)\1{2,}/.test(u)) score -= 20;
  if (/(.)\1/.test(u)) score -= 8;
  const ascenders = [...u].filter((c) => 'BDFHIJKLT'.includes(c)).length;
  const descenders = [...u].filter((c) => 'GJPQY'.includes(c)).length;
  if (ascenders > 3) score -= (ascenders - 3) * 5;
  if (descenders > 2) score -= (descenders - 2) * 5;
  if (/^[A-Z]+$/.test(u)) score += 5;
  return clamp(score);
}

export function scoreBrandStrength(name: string): number {
  let score = 68;
  const u = name.toUpperCase();
  const len = name.length;
  if (['K', 'V', 'Z', 'X'].includes(u[0])) score += 12;
  else if (['T', 'R', 'N', 'D'].includes(u[0])) score += 6;
  const last = u.slice(-1);
  if (last === 'X') score += 10;
  else if (last === 'K') score += 8;
  else if (['N', 'R', 'S'].includes(last)) score += 4;
  if (len >= 5 && len <= 6) score += 8;
  else if (len === 4) score += 5;
  if (/TR|KR|VR|GR|PR/.test(u)) score += 6;
  return clamp(score);
}

export function scoreGlobalPronunciation(name: string): number {
  let score = 80;
  const u = name.toUpperCase();
  if (u.includes('W')) score -= 10;
  if (u.includes('TH')) score -= 12;
  if (u.includes('NG') && u.indexOf('NG') > 0) score -= 8;
  if (u.includes('H') && u.indexOf('H') > 0) score -= 5;
  const universalRatio =
    [...u].filter((c) => !isVowel(c) && UNIVERSAL_CONSONANTS.has(c)).length /
    Math.max([...u].filter((c) => !isVowel(c)).length, 1);
  score += Math.round(universalRatio * 15);
  return clamp(score);
}

export function scoreSpanishPronunciation(name: string): number {
  let score = 78;
  const u = name.toUpperCase();
  if (/W/.test(u)) score -= 15;
  if (/TH/.test(u)) score -= 15;
  if (/PH/.test(u)) score -= 8;
  if (/Y(?=[AEIOU])/.test(u)) score += 5;
  if (u.includes('X')) score += 6;
  if (u[0] === 'V') score += 4;
  return clamp(score);
}

export function scoreEnglishPronunciation(name: string): number {
  let score = 78;
  const u = name.toUpperCase();
  if (/[AEIOU]{3,}/.test(u)) score -= 10;
  if (u[0] === 'Z') score += 5;
  if (/[AEIOU]{2}/.test(u)) score -= 3;
  return clamp(score);
}

export function scorePremiumPerception(name: string): number {
  let score = 68;
  const u = name.toUpperCase();
  const len = name.length;
  if (len >= 4 && len <= 6) score += 12;
  if (['K', 'V', 'Z'].includes(u[0])) score += 14;
  if (/TECH|SOFT|DIGI|PLAT|CLOUD/.test(u)) score -= 20;
  const hasLatinFeel = /[VELKRN]/.test(u[0]) && /[XNRS]/.test(u.slice(-1));
  if (hasLatinFeel) score += 8;
  return clamp(score);
}

export function scoreEngineeringPerception(name: string): number {
  let score = 68;
  const u = name.toUpperCase();
  if (/[XKS]$/.test(u)) score += 10;
  const consonantRatio = [...u].filter((c) => !isVowel(c)).length / u.length;
  if (consonantRatio >= 0.5 && consonantRatio <= 0.7) score += 8;
  if (/TR|KR|AX|IX/.test(u)) score += 6;
  return clamp(score);
}

export function scoreInnovationPerception(name: string): number {
  let score = 65;
  const u = name.toUpperCase();
  if (/KY|VR|ZN|YN/.test(u)) score += 12;
  if (/XO|YX|VX/.test(u)) score += 8;
  if (['Z', 'V', 'X'].includes(u[0])) score += 10;
  if (['K'].includes(u[0])) score += 6;
  const innerClusters = u.slice(1, -1);
  if (/[ZXKV]/.test(innerClusters)) score += 5;
  return clamp(score);
}

export function scoreOriginality(
  name: string,
  knownCompanies: Set<string>,
  commonWords: Set<string>,
): number {
  let score = 75;
  const lower = name.toLowerCase();
  if (knownCompanies.has(lower)) score -= 40;
  if (commonWords.has(lower)) score -= 20;
  const u = name.toUpperCase();
  const uniqueConsCombo = u.replace(/[AEIOU]/g, '').slice(0, 3);
  if (['KYN', 'VRX', 'ZNX', 'KRX', 'TRX'].includes(uniqueConsCombo)) score += 12;
  const WELL_KNOWN_ROOTS = ['veloc', 'apex', 'nexu', 'flux', 'kron'];
  for (const root of WELL_KNOWN_ROOTS) {
    if (lower.startsWith(root)) { score -= 8; break; }
  }
  return clamp(score);
}

export function scoreDomainAvailability(name: string): number {
  const lower = name.toLowerCase();
  let base = 80;
  if (name.length <= 4) base -= 15;
  if (name.length <= 5) base -= 8;
  if (/[XZK]$/.test(lower)) base += 5;
  if (/[ZXKVY]/.test(lower[0]) && name.length >= 5) base += 5;
  return clamp(base);
}

export function scoreTrademarkSafety(name: string, knownCompanies: Set<string>): number {
  const lower = name.toLowerCase();
  let score = 82;
  if (knownCompanies.has(lower)) score = 20;
  for (const known of knownCompanies) {
    if (Math.abs(known.length - lower.length) <= 1 && levenshtein(known, lower) <= 1) {
      score -= 30;
      break;
    }
  }
  return clamp(score);
}

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
    pronunciation, memorability, visualSymmetry, brandStrength,
    globalPronunciation, spanishPronunciation, englishPronunciation,
    premiumPerception, engineeringPerception, innovationPerception,
    originality, domainAvailability, trademarkSafety,
  };
  return { ...partial, final: calculateFinalScore(partial) };
}
