import type { ValidationResult } from './types.js';

/**
 * Validation module.
 *
 * Real validation requires live API access:
 * - Domain: WHOIS / registrar API
 * - Trademark: USPTO TESS, EUIPO TMView, WIPO Global Brand DB
 * - Search: Crunchbase, GitHub, Product Hunt, App Store, LinkedIn
 *
 * This module provides:
 * 1. Simulated results based on heuristics (for development/demo)
 * 2. The exact API call structure ready for real integration
 *
 * Set LIVE_VALIDATION=true and configure API keys to enable live checks.
 */

const LIVE_VALIDATION = process.env['LIVE_VALIDATION'] === 'true';

// ─── Simulated domain heuristic ───────────────────────────────────────────────

function simulateDomainAvailability(
  name: string,
  tld: string,
): { available: boolean | null; confidence: 'confirmed' | 'simulated' } {
  if (LIVE_VALIDATION) {
    // Real implementation: call WHOIS or registrar API
    // e.g., GET https://api.domainr.com/v2/status?domain={name}.{tld}&client_id=...
    return { available: null, confidence: 'confirmed' };
  }

  const lower = name.toLowerCase();
  const len = name.length;

  // Heuristic: very short names and common patterns are likely taken for .com
  if (tld === 'com') {
    if (len <= 4) return { available: false, confidence: 'simulated' };
    if (len <= 5 && /^[aeiou]/i.test(name))
      return { available: false, confidence: 'simulated' };
    return {
      available: len >= 6 || /[ZXKVY]/i.test(lower[0]),
      confidence: 'simulated',
    };
  }

  // .ai and .io are newer TLDs — most 5-7 letter invented names available
  if (tld === 'ai' || tld === 'io') {
    return { available: len >= 5, confidence: 'simulated' };
  }

  return { available: true, confidence: 'simulated' };
}

// ─── Simulated trademark heuristic ───────────────────────────────────────────

function simulateTrademark(name: string): {
  risk: 'low' | 'medium' | 'high' | 'unknown';
  confidence: 'simulated';
} {
  if (LIVE_VALIDATION) {
    // Real implementation:
    // USPTO TESS: https://tmsearch.uspto.gov/
    // EUIPO: https://euipo.europa.eu/eSearch/
    // WIPO: https://branddb.wipo.int/
    return { risk: 'unknown', confidence: 'simulated' };
  }

  const lower = name.toLowerCase();

  // Well-known collision patterns
  const HIGH_RISK_FRAGMENTS = [
    'nexon',
    'dynex',
    'cortex',
    'vortex',
    'xerox',
    'kronos',
    'orbex',
  ];
  if (HIGH_RISK_FRAGMENTS.some((f) => lower.includes(f) || f.includes(lower))) {
    return { risk: 'high', confidence: 'simulated' };
  }

  const MEDIUM_RISK_FRAGMENTS = ['arkon', 'drexon', 'navex'];
  if (MEDIUM_RISK_FRAGMENTS.some((f) => lower.startsWith(f.slice(0, 4)))) {
    return { risk: 'medium', confidence: 'simulated' };
  }

  return { risk: 'low', confidence: 'simulated' };
}

// ─── Simulated search presence ────────────────────────────────────────────────

function simulateSearchPresence(name: string): {
  crunchbase: boolean | null;
  github: boolean | null;
  productHunt: boolean | null;
  appStore: boolean | null;
} {
  if (LIVE_VALIDATION) {
    // Real implementation: call Crunchbase API, GitHub search, etc.
    return {
      crunchbase: null,
      github: null,
      productHunt: null,
      appStore: null,
    };
  }

  // Heuristic: fully invented names with unusual combinations are likely clear
  const u = name.toUpperCase();
  const isLikelyClear = /^[KVZYX]/.test(u) && name.length >= 5;
  const presence = !isLikelyClear;

  return {
    crunchbase: presence,
    github: null, // can't simulate reliably
    productHunt: null,
    appStore: null,
  };
}

// ─── Main validation function ─────────────────────────────────────────────────

export function validateName(
  name: string,
  targetDomains: string[],
): ValidationResult {
  const domain = Object.fromEntries(
    targetDomains.map((tld) => [tld, simulateDomainAvailability(name, tld)]),
  );

  const trademark = {
    uspto: simulateTrademark(name),
    euipo: simulateTrademark(name),
    wipo: simulateTrademark(name),
  };

  return {
    domain,
    trademark,
    searchConflicts: simulateSearchPresence(name),
    requiresLiveValidation: !LIVE_VALIDATION,
  };
}
