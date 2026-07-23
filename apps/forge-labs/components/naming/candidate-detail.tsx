'use client';

import type { WebCandidateFull } from '@mediafox/naming-engine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScoreBar } from './score-bar';
import { cn } from '@/lib/utils';
import {
  X,
  Download,
  GitCompare,
  Star,
  Globe,
  ShieldCheck,
  Lightbulb,
  Code2,
  Palette,
  Mic,
  BookOpen,
} from 'lucide-react';
import { useState } from 'react';

const SCORE_DIMENSIONS = [
  { key: 'originality', label: 'Originality', weight: '30%' },
  { key: 'brandStrength', label: 'Brand Strength', weight: '20%' },
  { key: 'memorability', label: 'Memorability', weight: '15%' },
  { key: 'pronunciation', label: 'Pronunciation', weight: '15%' },
  { key: 'domainAvailability', label: 'Domain Availability', weight: '10%' },
  { key: 'trademarkSafety', label: 'Trademark Safety', weight: '10%' },
  { key: 'globalPronunciation', label: 'Global Pronunciation', weight: '—' },
  { key: 'spanishPronunciation', label: 'Spanish', weight: '—' },
  { key: 'englishPronunciation', label: 'English', weight: '—' },
  { key: 'premiumPerception', label: 'Premium Perception', weight: '—' },
  { key: 'engineeringPerception', label: 'Engineering', weight: '—' },
  { key: 'innovationPerception', label: 'Innovation', weight: '—' },
  { key: 'visualSymmetry', label: 'Visual Symmetry', weight: '—' },
] as const;

type Tab = 'overview' | 'scores' | 'brand' | 'validation';

interface CandidateDetailProps {
  name: string;
  data: WebCandidateFull | null;
  onClose: () => void;
  onFounderReview: () => void;
  onAddToCompare: () => void;
  isInCompare: boolean;
}

export function CandidateDetail({
  name,
  data,
  onClose,
  onFounderReview,
  onAddToCompare,
  isInCompare,
}: CandidateDetailProps) {
  const [tab, setTab] = useState<Tab>('overview');

  if (!data) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center">
        <p className="text-sm">Full analysis only available for top 10.</p>
        <p className="mt-1 text-xs">Generate brands first.</p>
      </div>
    );
  }

  // Capture narrowed reference for use in closures
  const safeData = data;
  const { identity, scores, strategy, validation } = safeData;
  const riskColor =
    identity.trademarkRisk === 'low'
      ? 'success'
      : identity.trademarkRisk === 'medium'
        ? 'warning'
        : 'danger';

  function handleDownload() {
    const lines = [
      `# ${name.toUpperCase()} — Brand Analysis`,
      `Score: ${safeData.score.toFixed(1)}/100`,
      `Strategy: ${strategy}`,
      `Confidence: ${identity.confidence}%`,
      '',
      `## Pronunciation`,
      `EN: ${identity.pronunciationEN}`,
      `ES: ${identity.pronunciationES}`,
      '',
      `## Etymology`,
      identity.etymology,
      '',
      `## Brand Story`,
      identity.brandStory,
      '',
      `## Taglines`,
      ...identity.taglines.map((t) => `- ${t}`),
      '',
      `## Logo Direction`,
      identity.logoDirection,
      '',
      `## Trademark Risk: ${identity.trademarkRisk.toUpperCase()}`,
      identity.trademarkNotes,
      '',
      `## Investor Perception`,
      identity.investorPerception,
      '',
      `## Engineer Perception`,
      identity.engineerPerception,
      '',
      `## Score Breakdown`,
      ...SCORE_DIMENSIONS.map(
        (d) => `${d.label}: ${scores[d.key as keyof typeof scores]}`,
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase()}-brand-analysis.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-in flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-border flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xl font-bold tracking-widest">
            {name.toUpperCase()}
          </span>
          <span className="text-labs-blue text-2xl font-bold">
            {data.score.toFixed(1)}
          </span>
          <Badge variant={riskColor}>
            {identity.trademarkRisk.toUpperCase()} risk
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onAddToCompare}
            title="Add to comparison"
            className={isInCompare ? 'text-labs-blue' : ''}
          >
            <GitCompare className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onFounderReview}
            title="Founder review"
          >
            <Star className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDownload}
            title="Download report"
          >
            <Download className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border flex gap-1 border-b px-6 pt-1">
        {(['overview', 'scores', 'brand', 'validation'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-3 py-2 text-xs capitalize transition-colors',
              tab === t
                ? 'border-ring text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Pronunciation */}
            <Section icon={Mic} title="Pronunciation">
              <div className="grid grid-cols-2 gap-3">
                <div className="border-border bg-card rounded-md border p-3">
                  <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
                    English
                  </p>
                  <p className="font-mono text-sm">
                    {identity.pronunciationEN}
                  </p>
                </div>
                <div className="border-border bg-card rounded-md border p-3">
                  <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
                    Spanish
                  </p>
                  <p className="font-mono text-sm">
                    {identity.pronunciationES}
                  </p>
                </div>
              </div>
            </Section>

            {/* Etymology */}
            <Section icon={BookOpen} title="Etymology">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {identity.etymology}
              </p>
              <p className="mt-2 text-sm font-medium">
                {identity.coreConceptEN}
              </p>
            </Section>

            {/* Brand Story */}
            <Section icon={Lightbulb} title="Brand Story">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {identity.brandStory}
              </p>
            </Section>

            {/* Taglines */}
            <Section icon={Mic} title="Tagline Candidates">
              <div className="space-y-2">
                {identity.taglines.map((tagline, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5 text-xs">
                      {i + 1}.
                    </span>
                    <p className="text-foreground text-sm italic">
                      &ldquo;{tagline}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {tab === 'scores' && (
          <div className="space-y-6">
            {/* Final score highlight */}
            <div className="border-ring/30 bg-ring/5 rounded-lg border p-4 text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Final Score
              </p>
              <p className="mt-1 text-5xl font-bold tabular-nums">
                {data.score.toFixed(1)}
              </p>
              <p className="text-muted-foreground text-sm">/ 100</p>
            </div>

            {/* All dimensions */}
            <div className="space-y-2">
              {SCORE_DIMENSIONS.map(({ key, label, weight }) => {
                const val = scores[key as keyof typeof scores] as number;
                const isWeighted = weight !== '—';
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2',
                      isWeighted ? 'bg-card' : '',
                    )}
                  >
                    <span className="text-muted-foreground w-36 text-sm">
                      {label}
                    </span>
                    <ScoreBar value={val} className="flex-1" />
                    {weight !== '—' && (
                      <span className="text-muted-foreground w-8 text-right text-[11px]">
                        {weight}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'brand' && (
          <div className="space-y-6">
            {/* Logo direction */}
            <Section icon={Code2} title="Logo Direction">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {identity.logoDirection}
              </p>
            </Section>

            {/* Color palette */}
            <Section icon={Palette} title="Color Palette">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(identity.colorPalette).map(([role, color]) => (
                  <div
                    key={role}
                    className="border-border bg-card flex items-center gap-3 rounded-md border p-3"
                  >
                    <div
                      className="border-border/50 size-8 shrink-0 rounded-md border"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div>
                      <p className="text-xs font-medium capitalize">{role}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {color.hex}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {color.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Perceptions */}
            <Section icon={Lightbulb} title="Investor Perception">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {identity.investorPerception}
              </p>
            </Section>

            <Section icon={Code2} title="Engineer Perception">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {identity.engineerPerception}
              </p>
            </Section>
          </div>
        )}

        {tab === 'validation' && (
          <div className="space-y-6">
            {/* Domain status */}
            <Section icon={Globe} title="Domain Availability">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(validation.domain).map(([tld, result]) => (
                  <div
                    key={tld}
                    className="border-border bg-card flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="font-mono text-sm">
                      {name.toLowerCase()}.{tld}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          'size-2 rounded-full',
                          result.available === true
                            ? 'bg-emerald-500'
                            : result.available === false
                              ? 'bg-red-500'
                              : 'bg-amber-500',
                        )}
                      />
                      <span className="text-muted-foreground text-xs">
                        {result.available === true
                          ? 'Available'
                          : result.available === false
                            ? 'Taken'
                            : 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {validation.requiresLiveValidation && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Simulated results. Set LIVE_VALIDATION=true for real domain
                  checks.
                </p>
              )}
            </Section>

            {/* Trademark */}
            <Section icon={ShieldCheck} title="Trademark Jurisdictions">
              <div className="space-y-2">
                {Object.entries(validation.trademark).map(
                  ([jurisdiction, result]) => (
                    <div
                      key={jurisdiction}
                      className="border-border bg-card flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="text-sm font-medium uppercase">
                        {jurisdiction}
                      </span>
                      <Badge
                        variant={
                          result.risk === 'low'
                            ? 'success'
                            : result.risk === 'medium'
                              ? 'warning'
                              : result.risk === 'high'
                                ? 'danger'
                                : 'outline'
                        }
                      >
                        {result.risk.toUpperCase()}
                      </Badge>
                    </div>
                  ),
                )}
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {identity.trademarkNotes}
              </p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
