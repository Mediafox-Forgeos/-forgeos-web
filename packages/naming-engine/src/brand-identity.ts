import type { Strategy, NameScores } from './types';
import { LATIN_ROOTS, GREEK_ROOTS } from './data';

export type BrandColor = { hex: string; name: string };

export type BrandColorPalette = {
  primary: BrandColor;
  secondary: BrandColor;
  accent: BrandColor;
  neutral: BrandColor;
};

export type BrandIdentityFull = {
  pronunciationEN: string;
  pronunciationES: string;
  etymology: string;
  coreConceptEN: string;
  brandStory: string;
  taglines: [string, string, string];
  logoDirection: string;
  colorPalette: BrandColorPalette;
  trademarkRisk: 'low' | 'medium' | 'high';
  trademarkNotes: string;
  investorPerception: string;
  engineerPerception: string;
  confidence: number;
};

// ─── Pronunciation ────────────────────────────────────────────────────────────

function inferPronunciation(name: string): { en: string; es: string } {
  const u = name.toUpperCase();
  // Simple syllable-based pronunciation hint (not full IPA)
  const parts = u.match(/[BCDFGHJKLMNPQRSTVWXYZ]*[AEIOU][BCDFGHJKLMNPQRSTVWXYZ]*/g) ?? [u];
  const enSyllables = parts.map((p) => {
    if (p.startsWith('KY')) return 'KAI' + p.slice(2).toLowerCase();
    if (p.startsWith('K')) return 'K' + p.slice(1).toLowerCase();
    if (p.startsWith('VR')) return 'VR' + p.slice(2).toLowerCase();
    if (p.endsWith('X')) return p.slice(0, -1).toLowerCase() + 'KS';
    return p.toLowerCase();
  });
  const esSyllables = parts.map((p) => {
    if (p.startsWith('KY')) return 'KI' + p.slice(2).toLowerCase();
    if (p.startsWith('Z')) return 'S' + p.slice(1).toLowerCase();
    if (p.endsWith('X')) return p.slice(0, -1).toLowerCase() + 'ks';
    return p.toLowerCase();
  });
  return {
    en: enSyllables.join('-').toUpperCase(),
    es: esSyllables.join('-').toUpperCase(),
  };
}

// ─── Etymology ────────────────────────────────────────────────────────────────

function inferEtymology(name: string, strategy: Strategy): string {
  const lower = name.toLowerCase();

  if (strategy === 'greek') {
    for (const { root, meaning } of GREEK_ROOTS) {
      if (lower.startsWith(root.slice(0, Math.min(4, root.length)))) {
        return `From Greek "${root}" (${meaning}), modified for modern brand use.`;
      }
    }
    return 'Greek-heritage construction: classical root adapted with modern phonetic suffix.';
  }

  if (strategy === 'latin') {
    for (const { root, meaning } of LATIN_ROOTS) {
      if (lower.startsWith(root.slice(0, Math.min(4, root.length)))) {
        return `From Latin "${root}" (${meaning}), truncated and suffixed for brand clarity.`;
      }
    }
    return 'Latin-root derivation with modern terminal, echoing Roman engineering vocabulary.';
  }

  if (strategy === 'phonetic') {
    const u = name.toUpperCase();
    return `Phonetic construction: ${u.slice(0, 2)} cluster opening + tonal body → crisp terminal. No semantic baggage. Pure acoustic identity.`;
  }

  if (strategy === 'minimal') {
    return `Minimal brand architecture: ${name.length}-letter form factor. Maximum phonetic economy. Designed for instant recall and global typeability.`;
  }

  if (strategy === 'technology') {
    return `Technology-brand pattern: structured as [prefix + bridge + terminal]. Follows the naming grammar of market leaders (Figma, Linear, Notion).`;
  }

  if (strategy === 'meaning') {
    return `Meaning-first construction: syllables derived from industry keyword fragments, reassembled with brand suffix for semantic resonance.`;
  }

  if (strategy === 'oneword') {
    return `Curated root word with phonetic variant. One-word brand that carries cultural weight without literal meaning in the target category.`;
  }

  return `Invented word: original phoneme combination with no dictionary conflict in English or Spanish.`;
}

// ─── Core Concept ─────────────────────────────────────────────────────────────

function inferCoreConcept(name: string, strategy: Strategy): string {
  const u = name.toUpperCase();
  const last = u.slice(-1);
  const first = u[0];

  const endings: Record<string, string> = {
    X: 'precision, velocity, and finality',
    K: 'decisive authority and sharp focus',
    N: 'connection, openness, and global reach',
    R: 'resonance, drive, and forward momentum',
    S: 'systemic scale and operational confidence',
    T: 'technical exactness and reliability',
  };
  const openers: Record<string, string> = {
    K: 'kinetic power',
    V: 'velocity and vision',
    Z: 'zero-to-one innovation',
    T: 'technical authority',
    N: 'networked intelligence',
    R: 'reliable infrastructure',
  };

  const endDesc = endings[last] ?? 'balanced versatility';
  const startDesc = openers[first] ?? 'modern engineering identity';

  return `${startDesc} expressed through ${endDesc}.`;
}

// ─── Brand Story ──────────────────────────────────────────────────────────────

function inferBrandStory(name: string, strategy: Strategy): string {
  const u = name.toUpperCase();
  const last = u.slice(-1);

  const storyMap: Record<Strategy, string> = {
    greek: `${name} is built on Greek heritage — a civilization that believed in logos, precision, and the power of naming things correctly. The terminal gives it the crisp authority that modern enterprise software demands. Founders who choose ${name} signal that they think in systems, not features.`,
    latin: `${name} carries the weight of Latin engineering — aqueducts, roads, infrastructure that outlasted empires. The name signals permanence and trust at a time when the market is flooded with ephemeral products. ${name} is built to last.`,
    phonetic: `${name} was engineered, not discovered. Every phoneme was chosen for acoustic impact, global pronounceability, and trademark distinctiveness. It sounds like the future because it was designed to.`,
    minimal: `${name} is the shortest path between identity and recognition. At ${name.length} letters, it fits anywhere — a domain, a Slack handle, a Nasdaq ticker. Minimal by design. Maximum in presence.`,
    technology: `${name} follows the grammar of the most successful technology brands: a strong opener, a resonant bridge, a decisive close. It sits in the same phonetic family as brands that have defined decades.`,
    meaning: `${name} is constructed from the core vocabulary of its market — then abstracted into something that can be owned. The name carries the industry's DNA without being literal. It works at seed stage and at IPO.`,
    oneword: `${name} is a single word with a worldview. It doesn't describe the product — it becomes the product. The strongest brands in history are all one word. ${name} earns its place in that company.`,
    invented: `${name} belongs to no dictionary and no competitor. It is a clean phonemic slate — pronounceable in 40 languages, typeable on any keyboard, and available across every major domain. It is exactly what a global brand needs to be.`,
  };

  return storyMap[strategy] ?? `${name} is a brand name designed for global scale and category ownership.`;
}

// ─── Taglines ─────────────────────────────────────────────────────────────────

function inferTaglines(name: string): [string, string, string] {
  const u = name.toUpperCase();
  const last = u.slice(-1);

  if (last === 'X') return [
    `${name}. Intelligence at the edge.`,
    `${name}. Where precision meets scale.`,
    `Built on ${name}. Built to last.`,
  ];
  if (last === 'K') return [
    `${name}. Move first.`,
    `${name}. The future, decided.`,
    `The infrastructure behind the breakthrough. ${name}.`,
  ];
  if (last === 'N') return [
    `${name}. Connected. Always.`,
    `${name}. The network that never sleeps.`,
    `One platform. Every connection. ${name}.`,
  ];
  return [
    `${name}. Engineered for what's next.`,
    `${name}. The infrastructure of tomorrow.`,
    `Category-defining. ${name}.`,
  ];
}

// ─── Logo Direction ────────────────────────────────────────────────────────────

function inferLogoDirection(name: string, scores: NameScores): string {
  const u = name.toUpperCase();
  const brandStrength = scores.brandStrength;

  if (brandStrength >= 85) {
    return `Geometric wordmark, all caps, mono-weight sans-serif (Space Grotesk or Geist). The terminal character becomes the icon — isolatable and scalable to favicon. No tagline in primary lockup. Color: white on dark.`;
  }
  if (u.includes('X') || u.includes('K')) {
    return `Wordmark with editorial weight contrast: thin strokes for vowels, medium weight for consonants. Works at 12px and 120px. Terminal character optionally replaced by a geometric glyph.`;
  }
  return `Clean wordmark, mixed case with optical size adjustments. Custom letter spacing at -2%. Paired with a minimal geometric mark for icon use. Ideally monochromatic.`;
}

// ─── Color Palette ────────────────────────────────────────────────────────────

function inferColorPalette(strategy: Strategy, scores: NameScores): BrandColorPalette {
  const premiumScore = scores.premiumPerception;

  if (strategy === 'greek' || scores.innovationPerception >= 80) {
    return {
      primary: { hex: '#0f172a', name: 'Midnight Navy' },
      secondary: { hex: '#2563eb', name: 'Sapphire Blue' },
      accent: { hex: '#06b6d4', name: 'Aqua Spark' },
      neutral: { hex: '#e2e8f0', name: 'Platinum' },
    };
  }
  if (strategy === 'latin' || premiumScore >= 80) {
    return {
      primary: { hex: '#1c1917', name: 'Obsidian' },
      secondary: { hex: '#78350f', name: 'Bronze Deep' },
      accent: { hex: '#fbbf24', name: 'Gold Meridian' },
      neutral: { hex: '#fef3c7', name: 'Cream' },
    };
  }
  if (strategy === 'minimal' || strategy === 'phonetic') {
    return {
      primary: { hex: '#030712', name: 'Jet' },
      secondary: { hex: '#374151', name: 'Graphite' },
      accent: { hex: '#6366f1', name: 'Indigo Signal' },
      neutral: { hex: '#f9fafb', name: 'Interface White' },
    };
  }
  // Default: velocity palette
  return {
    primary: { hex: '#0a0f1e', name: 'Deep Indigo' },
    secondary: { hex: '#7c3aed', name: 'Electric Violet' },
    accent: { hex: '#c4b5fd', name: 'Lavender' },
    neutral: { hex: '#f0f4ff', name: 'Arctic White' },
  };
}

// ─── Trademark Risk ───────────────────────────────────────────────────────────

function inferTrademarkRisk(scores: NameScores): 'low' | 'medium' | 'high' {
  if (scores.trademarkSafety >= 80) return 'low';
  if (scores.trademarkSafety >= 60) return 'medium';
  return 'high';
}

function inferTrademarkNotes(name: string, scores: NameScores): string {
  const risk = inferTrademarkRisk(scores);
  if (risk === 'low') {
    return `Heuristic analysis indicates LOW risk. The name has sufficient phonetic distance from known marks. Formal USPTO/EUIPO search recommended before Series A.`;
  }
  if (risk === 'medium') {
    return `Moderate similarity to registered patterns detected. Engage a trademark attorney for a formal clearance opinion before public launch.`;
  }
  return `Name shares phonetic proximity with registered trademarks. Full clearance search required. Consider a phonetic variant or alternate suffix.`;
}

// ─── Perceptions ─────────────────────────────────────────────────────────────

function inferInvestorPerception(name: string, scores: NameScores): string {
  const total = scores.final;
  if (total >= 90) {
    return `Investor-grade brand identity. Short, owned, globally pronounceable. Signals category ambition. Strong for deck headers and stage presence. Comparable in quality to IPO-ready brand names.`;
  }
  if (total >= 80) {
    return `Strong brand candidate. Memorable and distinctive. Investors will recall it after one meeting. Consider aligning the name with a crisp one-line company description for maximum impact.`;
  }
  return `Solid functional brand. Clear and pronounceable. Investors will understand it quickly — focus the pitch on the product story while the brand builds equity over time.`;
}

function inferEngineerPerception(name: string, scores: NameScores): string {
  const engScore = scores.engineeringPerception;
  if (engScore >= 85) {
    return `Engineering-first brand signal. Terminal consonant and consonant cluster suggest precision systems, not consumer fluff. Engineers will trust a company named ${name} to have strong architecture decisions.`;
  }
  if (engScore >= 75) {
    return `Clear technical credibility. The name reads as a serious infrastructure or platform product. Works well in GitHub org names, CLI tools, and SDK namespaces.`;
  }
  return `Neutral technical perception. The name doesn't lead with engineering — which may be appropriate if the product targets non-technical buyers.`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateBrandIdentity(
  name: string,
  strategy: Strategy,
  scores: NameScores,
): BrandIdentityFull {
  const { en: pronunciationEN, es: pronunciationES } = inferPronunciation(name);

  return {
    pronunciationEN,
    pronunciationES,
    etymology: inferEtymology(name, strategy),
    coreConceptEN: inferCoreConcept(name, strategy),
    brandStory: inferBrandStory(name, strategy),
    taglines: inferTaglines(name),
    logoDirection: inferLogoDirection(name, scores),
    colorPalette: inferColorPalette(strategy, scores),
    trademarkRisk: inferTrademarkRisk(scores),
    trademarkNotes: inferTrademarkNotes(name, scores),
    investorPerception: inferInvestorPerception(name, scores),
    engineerPerception: inferEngineerPerception(name, scores),
    confidence: Math.min(97, Math.round(scores.final * 0.98)),
  };
}
