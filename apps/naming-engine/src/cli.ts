#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { EngineInput } from './types.js';
import { NamingEngine } from './engine.js';
import { generateMarkdownReport } from './report.js';

function usage(): void {
  console.log(`
MediaFOX Naming Engine v1.0

Usage:
  tsx src/cli.ts --input <file.json> [--output <report.md>]

Options:
  --input   Path to EngineInput JSON file (required)
  --output  Path to output Markdown report (default: reports/output.md)
  --help    Show this message

Environment:
  LIVE_VALIDATION=true  Enable live domain and trademark API checks
`);
}

function parseArgs(args: string[]): { input: string; output: string } | null {
  let input = '';
  let output = 'reports/output.md';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') { usage(); process.exit(0); }
    if (args[i] === '--input' && args[i + 1]) { input = args[++i]; }
    if (args[i] === '--output' && args[i + 1]) { output = args[++i]; }
  }

  if (!input) { usage(); return null; }
  return { input, output };
}

function main(): void {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (!parsed) { process.exit(1); }

  const inputPath = resolve(process.cwd(), parsed.input);
  const outputPath = resolve(process.cwd(), parsed.output);

  let engineInput: EngineInput;
  try {
    engineInput = JSON.parse(readFileSync(inputPath, 'utf-8')) as EngineInput;
  } catch (err) {
    console.error(`Error reading input file: ${inputPath}`);
    console.error(err);
    process.exit(1);
  }

  console.log('MediaFOX Naming Engine v1.0');
  console.log(`Industry: ${engineInput.industry}`);
  console.log('Generating candidates...\n');

  const engine = new NamingEngine(engineInput);
  const report = engine.run();

  console.log(`Generated:            ${report.stats.totalGenerated.toLocaleString()} candidates`);
  console.log(`After filters:        ${report.stats.afterLengthFilter.toLocaleString()}`);
  console.log(`After scoring:        ${report.stats.afterScoreThreshold.toLocaleString()} above threshold`);
  console.log(`Top 10:`);

  for (const c of report.top10.slice(0, 10)) {
    console.log(`  ${c.scores.final.toFixed(1).padStart(5)}  ${c.name}`);
  }

  // Note: top3 brand identities must be authored (see branding report)
  const markdown = generateMarkdownReport(report, [], {
    name: report.top10[0]?.name ?? '',
    score: report.top10[0]?.scores.final ?? 0,
    rank: 1,
    etymology: '— see branding report —',
    meaning: '— see branding report —',
    story: '— see branding report —',
    whyItWorks: [],
    potentialSlogans: [''],
    logoDirection: '— see branding report —',
    colorPalette: {
      primary: { hex: '#0A0A0F', role: '' },
      secondary: { hex: '#4B8BFF', role: '' },
      accent: { hex: '#F5F5F7', role: '' },
      semantic: { hex: '#F5A623', role: '' },
    },
    possibleDomains: [],
    trademarkRisk: 'low',
    trademarkNotes: '',
    confidenceLevel: 0,
    winnersRationale: '— see branding report —',
    whyOtherFinalistsLost: '— see branding report —',
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`\nReport written to: ${outputPath}`);

  if (process.env['LIVE_VALIDATION'] !== 'true') {
    console.log('\nNote: domain and trademark results are simulated.');
    console.log('Set LIVE_VALIDATION=true and configure API keys for live checks.');
  }
}

main();
