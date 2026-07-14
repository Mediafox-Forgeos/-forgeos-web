import type { Strategy, EngineInput } from './types';
import {
  ONSETS_PREMIUM,
  VOWEL_NUCLEI,
  CODAS_STRONG,
  CODAS_TERMINAL,
  LATIN_ROOTS,
  LATIN_SUFFIXES,
  LATIN_PREFIXES,
  GREEK_ROOTS,
  GREEK_SUFFIXES,
  TECH_PREFIXES,
  TECH_MIDDLES,
  TECH_TERMINALS,
  MINIMAL_CONSONANT_PAIRS,
  ONEWORD_SEEDS,
} from './data';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function inRange(s: string, min: number, max: number): boolean {
  return s.length >= min && s.length <= max;
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

export function generateInvented(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  for (const o1 of ONSETS_PREMIUM) {
    for (const v1 of VOWEL_NUCLEI) {
      for (const c1 of ['', ...CODAS_STRONG]) {
        for (const o2 of ONSETS_PREMIUM) {
          for (const v2 of VOWEL_NUCLEI) {
            for (const c2 of CODAS_TERMINAL) {
              const raw = (o1 + v1 + c1 + o2 + v2 + c2).toLowerCase();
              if (inRange(raw, min, max)) results.push(capitalize(raw));
            }
          }
        }
      }
    }
  }
  for (const o1 of ONSETS_PREMIUM.slice(0, 10)) {
    for (const v1 of VOWEL_NUCLEI) {
      for (const o2 of ONSETS_PREMIUM.slice(0, 8)) {
        for (const v2 of VOWEL_NUCLEI) {
          for (const c2 of CODAS_TERMINAL) {
            const raw = (o1 + v1 + o2 + v2 + c2).toLowerCase();
            if (inRange(raw, min, max)) results.push(capitalize(raw));
          }
        }
      }
    }
  }
  return dedupe(results);
}

/** Lite version for web use — ~9K premium invented names instead of 510K */
export function generateInventedLite(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  const fastOnsets = ONSETS_PREMIUM.slice(0, 10);
  for (const o1 of fastOnsets) {
    for (const v1 of VOWEL_NUCLEI) {
      for (const o2 of fastOnsets.slice(0, 6)) {
        for (const v2 of VOWEL_NUCLEI) {
          for (const c2 of CODAS_TERMINAL) {
            const raw = (o1 + v1 + o2 + v2 + c2).toLowerCase();
            if (inRange(raw, min, max)) results.push(capitalize(raw));
          }
        }
      }
    }
  }
  return dedupe(results);
}

export function generateLatin(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  for (const { root } of LATIN_ROOTS) {
    for (const suffix of LATIN_SUFFIXES) {
      const v1 = root + suffix;
      if (inRange(v1, min, max)) results.push(capitalize(v1));
      if (root.length > 3) {
        const v2 = root.slice(0, -1) + suffix;
        if (inRange(v2, min, max)) results.push(capitalize(v2));
      }
      const stripped = root.replace(/[aeiou]$/i, '');
      if (stripped !== root) {
        const v3 = stripped + suffix;
        if (inRange(v3, min, max)) results.push(capitalize(v3));
      }
    }
    for (const prefix of LATIN_PREFIXES) {
      const fragment = root.slice(0, 4);
      const combined = prefix + fragment;
      if (inRange(combined, min, max)) results.push(capitalize(combined));
    }
    for (let len = min; len <= Math.min(max, root.length); len++) {
      const truncated = root.slice(0, len);
      if (truncated.length >= min) results.push(capitalize(truncated));
    }
  }
  return dedupe(results);
}

export function generateGreek(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  for (const { root } of GREEK_ROOTS) {
    for (const suffix of GREEK_SUFFIXES) {
      const v1 = root + suffix;
      if (inRange(v1, min, max)) results.push(capitalize(v1));
      const stripped = root.replace(/[aeiou]$/i, '');
      if (stripped !== root) {
        const v2 = stripped + suffix;
        if (inRange(v2, min, max)) results.push(capitalize(v2));
      }
      if (root.length > 4) {
        const v3 = root.slice(0, -2) + suffix;
        if (inRange(v3, min, max)) results.push(capitalize(v3));
      }
    }
    for (let len = min; len <= Math.min(max, root.length); len++) {
      const t = root.slice(0, len);
      if (t.length >= min) results.push(capitalize(t));
    }
  }
  return dedupe(results);
}

export function generatePhonetic(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  const CLUSTERS = ['TR', 'KR', 'VR', 'GR', 'PR', 'BR', 'DR', 'STR', 'SK', 'FL'];
  const BRIDGES = ['A', 'E', 'I', 'O', 'U', 'AX', 'EX', 'IX', 'ON', 'AN'];
  const CLOSERS = ['IX', 'EX', 'AX', 'ON', 'AR', 'OX', 'EN', 'IN'];
  for (const cluster of CLUSTERS) {
    for (const bridge of BRIDGES) {
      for (const closer of CLOSERS) {
        const raw = (cluster + bridge + closer).toLowerCase();
        if (inRange(raw, min, max)) results.push(capitalize(raw));
        for (const c of ['N', 'V', 'K', 'R', 'L']) {
          const raw2 = (cluster + bridge + c + closer).toLowerCase();
          if (inRange(raw2, min, max)) results.push(capitalize(raw2));
        }
      }
    }
  }
  return dedupe(results);
}

export function generateMeaning(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  const fragments = input.keywords.flatMap((kw) => {
    const k = kw.toLowerCase();
    return [k.slice(0, 3), k.slice(0, 4), k.slice(0, 5), k.slice(-3), k.slice(-4)].filter((f) => f.length >= 2);
  });
  const CONNECTORS = ['', 'A', 'E', 'I', 'O'];
  const TERMINALS = ['ex', 'ax', 'ix', 'on', 'ar', 'er', 'ox', 'is'];
  for (const frag1 of fragments) {
    for (const frag2 of fragments) {
      if (frag1 === frag2) continue;
      for (const conn of CONNECTORS) {
        for (const term of TERMINALS) {
          const raw = (frag1 + conn + frag2.slice(0, 2) + term).toLowerCase();
          if (inRange(raw, min, max)) results.push(capitalize(raw));
        }
      }
    }
    for (const term of TERMINALS) {
      const raw = (frag1 + term).toLowerCase();
      if (inRange(raw, min, max)) results.push(capitalize(raw));
    }
  }
  return dedupe(results);
}

export function generateTechnology(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  for (const prefix of TECH_PREFIXES) {
    for (const middle of TECH_MIDDLES) {
      for (const terminal of TECH_TERMINALS) {
        const raw = (prefix + middle + terminal).toLowerCase();
        if (inRange(raw, min, max)) results.push(capitalize(raw));
      }
      const raw = (prefix + middle).toLowerCase();
      if (inRange(raw, min, max)) results.push(capitalize(raw));
    }
    for (const terminal of TECH_TERMINALS) {
      const raw = (prefix + terminal).toLowerCase();
      if (inRange(raw, min, max)) results.push(capitalize(raw));
    }
  }
  return dedupe(results);
}

export function generateMinimal(input: EngineInput): string[] {
  const { min } = input.lengthConstraints;
  const effectiveMin = Math.max(min, 4);
  const effectiveMax = 5;
  const results: string[] = [];
  for (const pair of MINIMAL_CONSONANT_PAIRS) {
    for (const v of VOWEL_NUCLEI) {
      for (const c of CODAS_TERMINAL) {
        const raw = (pair + v + c).toLowerCase();
        if (inRange(raw, effectiveMin, effectiveMax)) results.push(capitalize(raw));
        const p0 = pair[0];
        const p1 = pair.slice(1);
        for (const vi of VOWEL_NUCLEI) {
          const raw2 = (p0 + vi + p1 + v + c).toLowerCase();
          if (inRange(raw2, effectiveMin, effectiveMax)) results.push(capitalize(raw2));
        }
      }
    }
  }
  return dedupe(results);
}

export function generateOneWord(input: EngineInput): string[] {
  const { min, max } = input.lengthConstraints;
  const results: string[] = [];
  for (const seed of ONEWORD_SEEDS) {
    const w = seed.word;
    results.push(capitalize(w));
    const variants = [
      w.replace(/us$/, 'ex'), w.replace(/us$/, 'ix'), w.replace(/um$/, 'ex'),
      w.replace(/os$/, 'ex'), w.replace(/is$/, 'ax'), w.replace(/on$/, 'ex'),
      w.slice(0, -1) + 'x', w.slice(0, -1) + 'k',
      w.replace(/a/, 'e'), w.replace(/o/, 'a'),
    ];
    for (const v of variants) {
      if (inRange(v, min, max)) results.push(capitalize(v));
    }
  }
  const kwFragments = input.keywords.slice(0, 8).map((k) => k.toLowerCase().slice(0, 5));
  for (const f of kwFragments) {
    results.push(capitalize(f + 'ex'));
    results.push(capitalize(f + 'ix'));
    results.push(capitalize(f + 'ax'));
    results.push(capitalize('ne' + f.slice(0, 3)));
  }
  return dedupe(results.filter((r) => inRange(r, min, max)));
}

export type GeneratedSet = { candidates: string[]; byStrategy: Record<Strategy, string[]> };

export function generateAll(input: EngineInput): GeneratedSet {
  const byStrategy: Record<Strategy, string[]> = {
    invented: generateInvented(input),
    latin: generateLatin(input),
    greek: generateGreek(input),
    phonetic: generatePhonetic(input),
    meaning: generateMeaning(input),
    technology: generateTechnology(input),
    minimal: generateMinimal(input),
    oneword: generateOneWord(input),
  };
  const allWithStrategy = Object.entries(byStrategy).flatMap(([strategy, names]) =>
    names.map((name) => ({ name, strategy: strategy as Strategy })),
  );
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const { name } of allWithStrategy) {
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); candidates.push(name); }
  }
  return { candidates, byStrategy };
}

export function generateAllWeb(input: EngineInput): GeneratedSet {
  const byStrategy: Record<Strategy, string[]> = {
    invented: generateInventedLite(input),
    latin: generateLatin(input),
    greek: generateGreek(input),
    phonetic: generatePhonetic(input),
    meaning: generateMeaning(input),
    technology: generateTechnology(input),
    minimal: generateMinimal(input),
    oneword: generateOneWord(input),
  };
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const names of Object.values(byStrategy)) {
    for (const name of names) {
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); candidates.push(name); }
    }
  }
  return { candidates, byStrategy };
}
