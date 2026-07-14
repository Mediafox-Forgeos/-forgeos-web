import type { EngineInput, FilterResult } from './types';
import {
  PROBLEMATIC_PATTERNS,
  NEGATIVE_FRAGMENTS,
  KNOWN_COMPANY_NAMES,
  COMMON_ENGLISH_WORDS,
  COMMON_SPANISH_WORDS,
} from './data';

function filterLength(name: string, input: EngineInput): FilterResult {
  const len = name.length;
  if (len < input.lengthConstraints.min)
    return { status: 'fail', reason: `too short (${len} < ${input.lengthConstraints.min})` };
  if (len > input.lengthConstraints.max)
    return { status: 'fail', reason: `too long (${len} > ${input.lengthConstraints.max})` };
  return { status: 'pass' };
}

function filterForbiddenWords(name: string, input: EngineInput): FilterResult {
  const lower = name.toLowerCase();
  for (const word of input.forbidden.words) {
    if (lower.includes(word.toLowerCase()))
      return { status: 'fail', reason: `contains forbidden word: ${word}` };
  }
  return { status: 'pass' };
}

function filterForbiddenSuffixes(name: string, input: EngineInput): FilterResult {
  const lower = name.toLowerCase();
  for (const suffix of input.forbidden.suffixes) {
    if (lower.endsWith(suffix.toLowerCase()))
      return { status: 'fail', reason: `ends with forbidden suffix: ${suffix}` };
  }
  return { status: 'pass' };
}

function filterPhonetics(name: string): FilterResult {
  for (const pattern of PROBLEMATIC_PATTERNS) {
    if (pattern.test(name))
      return { status: 'fail', reason: `phonetic pattern violation: ${pattern}` };
  }
  return { status: 'pass' };
}

function filterNegativeMeanings(name: string): FilterResult {
  const lower = name.toLowerCase();
  for (const fragment of NEGATIVE_FRAGMENTS) {
    if (lower.includes(fragment))
      return { status: 'fail', reason: `contains negative fragment: ${fragment}` };
  }
  return { status: 'pass' };
}

function filterDictionaryWords(name: string): FilterResult {
  const lower = name.toLowerCase();
  if (COMMON_ENGLISH_WORDS.has(lower)) return { status: 'fail', reason: 'common English word' };
  if (COMMON_SPANISH_WORDS.has(lower)) return { status: 'fail', reason: 'common Spanish word' };
  return { status: 'pass' };
}

function filterKnownCompanies(name: string): FilterResult {
  if (KNOWN_COMPANY_NAMES.has(name.toLowerCase()))
    return { status: 'fail', reason: 'existing company name' };
  return { status: 'pass' };
}

function filterConsecutiveConsonants(name: string): FilterResult {
  if (/[^AEIOU]{4,}/i.test(name)) return { status: 'fail', reason: '4+ consecutive consonants' };
  return { status: 'pass' };
}

function filterExcessiveVowels(name: string): FilterResult {
  if (/[AEIOU]{3,}/i.test(name)) return { status: 'fail', reason: '3+ consecutive vowels' };
  return { status: 'pass' };
}

function filterAllConsonants(name: string): FilterResult {
  if (!/[AEIOU]/i.test(name)) return { status: 'fail', reason: 'no vowels' };
  return { status: 'pass' };
}

export function applyFilters(name: string, input: EngineInput): FilterResult {
  const checks: FilterResult[] = [
    filterLength(name, input),
    filterForbiddenWords(name, input),
    filterForbiddenSuffixes(name, input),
    filterPhonetics(name),
    filterNegativeMeanings(name),
    filterDictionaryWords(name),
    filterKnownCompanies(name),
    filterConsecutiveConsonants(name),
    filterExcessiveVowels(name),
    filterAllConsonants(name),
  ];
  const failure = checks.find((r) => r.status === 'fail');
  return failure ?? { status: 'pass' };
}

export function filterCandidates(
  names: string[],
  input: EngineInput,
): { passed: string[]; rejected: Array<{ name: string; reason: string }> } {
  const passed: string[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const name of names) {
    const result = applyFilters(name, input);
    if (result.status === 'pass') passed.push(name);
    else rejected.push({ name, reason: result.reason ?? 'unknown' });
  }
  return { passed, rejected };
}
