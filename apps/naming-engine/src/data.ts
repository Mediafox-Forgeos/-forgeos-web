// ─── Phoneme tables ──────────────────────────────────────────────────────────

/** Onsets ordered by brand desirability (strong tech consonants first) */
export const ONSETS_PREMIUM = [
  'K', 'V', 'Z', 'TR', 'KR', 'VR', 'GR', 'PR', 'FL', 'BR', 'DR',
  'N', 'T', 'R', 'L', 'M', 'D', 'F', 'S', 'B', 'G', 'P',
  'STR', 'SK', 'SL', 'SM', 'SN', 'SP', 'ST',
] as const;

export const VOWEL_NUCLEI = ['A', 'E', 'I', 'O', 'U'] as const;

export const VOWEL_EXTENDED = ['A', 'E', 'I', 'O', 'U', 'AE', 'EI', 'AI', 'AU'] as const;

export const CODAS_STRONG = ['X', 'K', 'N', 'R', 'T', 'S', 'L', 'V', 'Z'] as const;

export const CODAS_TERMINAL = ['X', 'K', 'N', 'R', 'T', 'S'] as const;

// ─── Latin roots ─────────────────────────────────────────────────────────────

export const LATIN_ROOTS: Array<{ root: string; meaning: string }> = [
  { root: 'veloc', meaning: 'fast, swift' },
  { root: 'nexu', meaning: 'connection, bond' },
  { root: 'mobil', meaning: 'mobile, moving' },
  { root: 'arcu', meaning: 'arc, curve' },
  { root: 'via', meaning: 'way, road, path' },
  { root: 'celer', meaning: 'swift, rapid' },
  { root: 'cursu', meaning: 'course, path, run' },
  { root: 'flux', meaning: 'flow, stream' },
  { root: 'orbis', meaning: 'circle, sphere, orbit' },
  { root: 'vertic', meaning: 'peak, vertex, turning point' },
  { root: 'vinc', meaning: 'conquer, bind, overcome' },
  { root: 'gravis', meaning: 'significant, weighty' },
  { root: 'acies', meaning: 'sharp edge, precision' },
  { root: 'lucid', meaning: 'clear, bright, luminous' },
  { root: 'aevum', meaning: 'eternity, age, epoch' },
  { root: 'numin', meaning: 'divine power, command' },
  { root: 'impetu', meaning: 'force, impetus, momentum' },
  { root: 'apex', meaning: 'peak, highest point' },
  { root: 'axil', meaning: 'axis, pivot' },
  { root: 'cohor', meaning: 'cohort, unit, assembly' },
] as const;

export const LATIN_SUFFIXES = ['ex', 'ar', 'on', 'ix', 'ax', 'en', 'ox', 'er', 'el'] as const;
export const LATIN_PREFIXES = ['ve', 'ne', 'a', 'co', 'in', 're', 'pro'] as const;

// ─── Greek roots ─────────────────────────────────────────────────────────────

export const GREEK_ROOTS: Array<{ root: string; meaning: string }> = [
  { root: 'kyne', meaning: 'to drive, urge, propel forward' },
  { root: 'kinet', meaning: 'movement, motion, kinetic' },
  { root: 'tachy', meaning: 'fast, rapid, swift' },
  { root: 'telos', meaning: 'purpose, goal, end' },
  { root: 'holos', meaning: 'whole, complete, entire' },
  { root: 'kairos', meaning: 'the right moment, opportunity' },
  { root: 'drom', meaning: 'course, running, track' },
  { root: 'logos', meaning: 'reason, intelligence, word' },
  { root: 'kryp', meaning: 'hidden, encrypted, secure' },
  { root: 'kalos', meaning: 'beautiful, excellent, fine' },
  { root: 'onk', meaning: 'force, mass, volume' },
  { root: 'aer', meaning: 'air, atmosphere, elevation' },
  { root: 'rythm', meaning: 'rhythm, flow, cadence' },
  { root: 'prax', meaning: 'practice, action, doing' },
  { root: 'zen', meaning: 'zenith, peak, summit (via Arabic)' },
  { root: 'kron', meaning: 'time, duration, mastery' },
  { root: 'noos', meaning: 'mind, intelligence' },
  { root: 'erg', meaning: 'work, energy, operation' },
  { root: 'phor', meaning: 'carrier, bearer, conductor' },
  { root: 'troph', meaning: 'nourishment, growth, sustaining' },
] as const;

export const GREEK_SUFFIXES = ['ex', 'ax', 'ix', 'on', 'os', 'ar', 'en'] as const;

// ─── Technology brand patterns ────────────────────────────────────────────────

export const TECH_PREFIXES = [
  'A', 'Z', 'K', 'V', 'X', 'N', 'S', 'D',
  'Ar', 'Ve', 'Zi', 'Ka', 'No', 'Kr', 'Tr', 'Vr',
] as const;

export const TECH_MIDDLES = [
  'ol', 'ar', 'el', 'on', 'iv', 'ax', 'ox', 'en',
  'ov', 'an', 'in', 'ex', 'al', 'or',
] as const;

export const TECH_TERMINALS = [
  'ex', 'ix', 'ax', 'on', 'ar', 'er', 'ox', 'en', 'al',
] as const;

// ─── Minimal brand seeds ──────────────────────────────────────────────────────

export const MINIMAL_CONSONANT_PAIRS = [
  'KV', 'VR', 'ZK', 'TR', 'KR', 'GR', 'PR', 'BR', 'DR',
  'NK', 'VX', 'ZN', 'KN', 'TN', 'RV', 'LK', 'MV',
] as const;

// ─── Curated one-word seeds (cross-language evocative words) ──────────────────

export const ONEWORD_SEEDS = [
  { word: 'navis', lang: 'latin', meaning: 'ship, navigator' },
  { word: 'celer', lang: 'latin', meaning: 'swift' },
  { word: 'novus', lang: 'latin', meaning: 'new' },
  { word: 'verus', lang: 'latin', meaning: 'true, genuine' },
  { word: 'nexum', lang: 'latin', meaning: 'bond, connection' },
  { word: 'aurum', lang: 'latin', meaning: 'gold, precious' },
  { word: 'kuros', lang: 'greek', meaning: 'youth, forward momentum' },
  { word: 'aeon', lang: 'greek', meaning: 'age, era, vast time' },
  { word: 'kalon', lang: 'greek', meaning: 'beauty, excellence' },
  { word: 'ergon', lang: 'greek', meaning: 'work, operation' },
  { word: 'kosmik', lang: 'greek', meaning: 'ordered, universal' },
  { word: 'nomos', lang: 'greek', meaning: 'order, law, system' },
  { word: 'vivos', lang: 'latin', meaning: 'alive, living, vital' },
  { word: 'solum', lang: 'latin', meaning: 'ground, foundation, soil' },
  { word: 'rivus', lang: 'latin', meaning: 'stream, flow, course' },
] as const;

// ─── Known companies to flag (trademark risk list — partial) ─────────────────

export const KNOWN_COMPANY_NAMES = new Set([
  'nexon', 'dynex', 'devex', 'navex', 'orbex', 'kronos', 'cortex',
  'vortex', 'vertex', 'apex', 'axiom', 'navis', 'novus', 'codex',
  'zenix', 'logix', 'rinex', 'centrex', 'andrex', 'mirex', 'pyrex',
  'xerox', 'rolex', 'zolux', 'airex', 'matrex', 'clorox',
]);

// ─── English dictionary words to reject ──────────────────────────────────────

export const COMMON_ENGLISH_WORDS = new Set([
  'taxes', 'relax', 'index', 'annex', 'latex', 'reflex', 'complex',
  'duplex', 'reflex', 'convex', 'matrix', 'helix', 'radix', 'varix',
  'calyx', 'gravel', 'travel', 'drivel', 'level', 'seven', 'raven',
  'liven', 'given', 'driven', 'striven', 'frozen', 'brazen', 'fasten',
]);

// ─── Spanish words to reject ─────────────────────────────────────────────────

export const COMMON_SPANISH_WORDS = new Set([
  'traes', 'taxis', 'nexos', 'naves', 'vinos', 'redes',
]);

// ─── Phonetically problematic patterns ───────────────────────────────────────

export const PROBLEMATIC_PATTERNS = [
  /(.)\1{2,}/i,    // triple+ repeated character
  /[aeiou]{4,}/i,  // 4+ consecutive vowels
  /[^aeiou]{5,}/i, // 5+ consecutive consonants
  /^[aeiou]/i,     // starts with vowel (weaker brand opening for tech)
  /gh/i,           // ambiguous English digraph
  /wr/i,           // silent W
  /kn/i,           // silent K
] as const;

// ─── Negative meaning fragments to reject ────────────────────────────────────

export const NEGATIVE_FRAGMENTS = [
  'kill', 'die', 'dead', 'fail', 'bad', 'evil', 'sick', 'ugly', 'rot',
  'war', 'hate', 'foul', 'crud', 'dump', 'junk', 'ruin', 'doom',
] as const;
