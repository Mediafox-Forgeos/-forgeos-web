import type { BrandingReport, CandidateName, BrandIdentity, Strategy } from './types.js';

function strategyLabel(s: Strategy): string {
  const map: Record<Strategy, string> = {
    invented: 'Invented',
    latin: 'Latin Root',
    greek: 'Greek Root',
    phonetic: 'Phonetic',
    meaning: 'Meaning-First',
    technology: 'Technology',
    minimal: 'Minimal',
    oneword: 'One-Word',
  };
  return map[s];
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score.toFixed(1)}`;
}

// ─── Report sections ──────────────────────────────────────────────────────────

export function formatHeader(report: BrandingReport): string {
  const input = report.input;
  return `# MediaFOX Forge — Branding Report
## ${input.industry}

| Property | Value |
| --- | --- |
| **Generated** | ${new Date(report.generatedAt).toLocaleString()} |
| **Industry** | ${input.industry} |
| **Languages** | ${input.languages.join(', ')} |
| **Length Range** | ${input.lengthConstraints.min}–${input.lengthConstraints.max} letters (preferred ${input.lengthConstraints.preferred[0]}–${input.lengthConstraints.preferred[1]}) |
| **Engine** | MediaFOX Naming Engine v1.0 |

---

## Generation Statistics

| Stage | Count |
| --- | --- |
| Total generated | **${report.stats.totalGenerated.toLocaleString()}** |
| After length filter | ${report.stats.afterLengthFilter.toLocaleString()} |
| After quality filter | ${report.stats.afterQualityFilter.toLocaleString()} |
| After score threshold (≥65) | ${report.stats.afterScoreThreshold.toLocaleString()} |

### By Strategy

${Object.entries(report.stats.byStrategy)
    .map(([strategy, count]) => `| ${strategyLabel(strategy as Strategy)} | ${count.toLocaleString()} |`)
    .join('\n')}

---`;
}

export function formatTop100(report: BrandingReport): string {
  const rows = report.top100
    .map(
      (c, i) =>
        `| ${String(i + 1).padStart(3)} | **${c.name}** | ${c.score.toFixed(1)} | ${strategyLabel(c.strategy)} | ${c.descriptor} |`,
    )
    .join('\n');

  return `## TOP 100 Candidates

| Rank | Name | Score | Strategy | Descriptor |
| ---: | --- | ---: | --- | --- |
${rows}

---`;
}

export function formatTop25(report: BrandingReport): string {
  const rows = report.top25
    .map(
      (c, i) => `| ${String(i + 1).padStart(2)} | **${c.name}** | ${c.score.toFixed(1)} | ${strategyLabel(c.strategy)} | ${c.oneLine} |`,
    )
    .join('\n');

  return `## TOP 25 Finalists

| Rank | Name | Score | Strategy | Analysis |
| ---: | --- | ---: | --- | --- |
${rows}

---`;
}

export function formatTop10(candidates: CandidateName[]): string {
  const sections = candidates
    .slice(0, 10)
    .map((c, i) => {
      const s = c.scores;
      return `### ${i + 1}. ${c.name.toUpperCase()} — ${s.final.toFixed(1)}/100

| Dimension | Score | Bar |
| --- | ---: | --- |
| Pronunciation | ${s.pronunciation} | ${scoreBar(s.pronunciation)} |
| Memorability | ${s.memorability} | ${scoreBar(s.memorability)} |
| Visual Symmetry | ${s.visualSymmetry} | ${scoreBar(s.visualSymmetry)} |
| Brand Strength | ${s.brandStrength} | ${scoreBar(s.brandStrength)} |
| Global Pronunciation | ${s.globalPronunciation} | ${scoreBar(s.globalPronunciation)} |
| Spanish Pronunciation | ${s.spanishPronunciation} | ${scoreBar(s.spanishPronunciation)} |
| English Pronunciation | ${s.englishPronunciation} | ${scoreBar(s.englishPronunciation)} |
| Premium Perception | ${s.premiumPerception} | ${scoreBar(s.premiumPerception)} |
| Engineering Perception | ${s.engineeringPerception} | ${scoreBar(s.engineeringPerception)} |
| Innovation Perception | ${s.innovationPerception} | ${scoreBar(s.innovationPerception)} |
| **Originality** | **${s.originality}** | **${scoreBar(s.originality)}** |
| Domain Availability | ${s.domainAvailability} | ${scoreBar(s.domainAvailability)} |
| Trademark Safety | ${s.trademarkSafety} | ${scoreBar(s.trademarkSafety)} |
| **FINAL (weighted)** | **${s.final.toFixed(1)}** | **${scoreBar(s.final)}** |

Strategy: ${strategyLabel(c.strategy)}
`;
    })
    .join('\n');

  return `## TOP 10 — Score Breakdown\n\n${sections}\n---`;
}

export function formatFinalist(identity: BrandIdentity, rank: number): string {
  return `### #${rank} — ${identity.name.toUpperCase()}

**Final Score: ${identity.score.toFixed(1)}/100**

#### Etymology
${identity.etymology}

#### Meaning
${identity.meaning}

#### Brand Story
${identity.story}

#### Why It Works
${identity.whyItWorks.map((w) => `- ${w}`).join('\n')}

${identity.whyItLost ? `#### Why It Didn't Win\n${identity.whyItLost.map((w) => `- ${w}`).join('\n')}\n` : ''}

#### Potential Slogans
${identity.potentialSlogans.map((s) => `- *"${s}"*`).join('\n')}

#### Logo Direction
${identity.logoDirection}

#### Color Palette
| Role | Hex | Purpose |
| --- | --- | --- |
| Primary | \`${identity.colorPalette.primary.hex}\` | ${identity.colorPalette.primary.role} |
| Secondary | \`${identity.colorPalette.secondary.hex}\` | ${identity.colorPalette.secondary.role} |
| Accent | \`${identity.colorPalette.accent.hex}\` | ${identity.colorPalette.accent.role} |
| Semantic | \`${identity.colorPalette.semantic.hex}\` | ${identity.colorPalette.semantic.role} |

#### Possible Domains
${identity.possibleDomains.map((d) => `- \`${d}\``).join('\n')}

#### Trademark Risk: ${identity.trademarkRisk.toUpperCase()}
${identity.trademarkNotes}

**Confidence Level: ${identity.confidenceLevel}%**

---`;
}

export function generateMarkdownReport(
  report: BrandingReport,
  top3Identities: BrandIdentity[],
  winner: BrandIdentity & { winnersRationale: string; whyOtherFinalistsLost: string },
): string {
  const sections: string[] = [
    formatHeader(report),
    formatTop100(report),
    formatTop25(report),
    formatTop10(report.top10),
    `## TOP 3 — Full Brand Identity\n\n${top3Identities.map((id, i) => formatFinalist(id, i + 1)).join('\n')}`,
    formatWinner(winner),
  ];

  return sections.join('\n\n');
}

export function formatWinner(
  winner: BrandIdentity & { winnersRationale: string; whyOtherFinalistsLost: string },
): string {
  return `## THE WINNER

---

# ${winner.name.toUpperCase()}

### *${winner.potentialSlogans[0]}*

**Final Score: ${winner.score.toFixed(1)}/100 | Confidence: ${winner.confidenceLevel}%**

---

${formatFinalist(winner, 1).replace(/^### #1 — .*\n/, '')}

### Winner's Rationale

${winner.winnersRationale}

### Why the Other Finalists Lost

${winner.whyOtherFinalistsLost}

---

*Report generated by MediaFOX Naming Engine v1.0*
*VULCAN — Lead Software Engineer, MediaFOX Forge*`;
}
