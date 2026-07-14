import type { ValidationResult } from './types';

const LIVE_VALIDATION = process.env['LIVE_VALIDATION'] === 'true';

function simulateDomainAvailability(
  name: string,
  tld: string,
): { available: boolean | null; confidence: 'confirmed' | 'simulated' } {
  if (LIVE_VALIDATION) return { available: null, confidence: 'confirmed' };
  const lower = name.toLowerCase();
  const len = name.length;
  if (tld === 'com') {
    if (len <= 4) return { available: false, confidence: 'simulated' };
    if (len <= 5 && /^[aeiou]/i.test(name)) return { available: false, confidence: 'simulated' };
    return { available: len >= 6 || /[ZXKVY]/i.test(lower[0]), confidence: 'simulated' };
  }
  if (tld === 'ai' || tld === 'io') return { available: len >= 5, confidence: 'simulated' };
  return { available: true, confidence: 'simulated' };
}

function simulateTrademark(
  name: string,
): { risk: 'low' | 'medium' | 'high' | 'unknown'; confidence: 'simulated' } {
  if (LIVE_VALIDATION) return { risk: 'unknown', confidence: 'simulated' };
  const lower = name.toLowerCase();
  const HIGH_RISK = ['nexon', 'dynex', 'cortex', 'vortex', 'xerox', 'kronos', 'orbex'];
  if (HIGH_RISK.some((f) => lower.includes(f) || f.includes(lower)))
    return { risk: 'high', confidence: 'simulated' };
  const MEDIUM_RISK = ['arkon', 'drexon', 'navex'];
  if (MEDIUM_RISK.some((f) => lower.startsWith(f.slice(0, 4))))
    return { risk: 'medium', confidence: 'simulated' };
  return { risk: 'low', confidence: 'simulated' };
}

function simulateSearchPresence(name: string) {
  if (LIVE_VALIDATION) return { crunchbase: null, github: null, productHunt: null, appStore: null };
  const u = name.toUpperCase();
  const isLikelyClear = /^[KVZYX]/.test(u) && name.length >= 5;
  return {
    crunchbase: !isLikelyClear,
    github: null,
    productHunt: null,
    appStore: null,
  };
}

export function validateName(name: string, targetDomains: string[]): ValidationResult {
  const domain = Object.fromEntries(
    targetDomains.map((tld) => [tld, simulateDomainAvailability(name, tld)]),
  );
  return {
    domain,
    trademark: {
      uspto: simulateTrademark(name),
      euipo: simulateTrademark(name),
      wipo: simulateTrademark(name),
    },
    searchConflicts: simulateSearchPresence(name),
    requiresLiveValidation: !LIVE_VALIDATION,
  };
}
