'use client';

import type { WebNamingResult } from '@mediafox/naming-engine';
import { Sparkles, Filter, BarChart3, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RunPanelProps {
  isPending: boolean;
  progress: number;
  progressLabel: string;
  results: WebNamingResult | null;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4">
      <div className="text-muted-foreground flex items-center gap-2">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  );
}

export function RunPanel({
  isPending,
  progress,
  progressLabel,
  results,
}: RunPanelProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10">
      {/* Empty state */}
      {!isPending && !results && (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="border-border bg-muted grid size-16 place-items-center rounded-2xl border">
            <Sparkles className="text-muted-foreground size-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Ready to generate</h3>
            <p className="text-muted-foreground mt-1 text-balance text-sm">
              Fill in the project parameters and click{' '}
              <span className="text-foreground font-medium">
                Generate Brands
              </span>{' '}
              to run the engine across 50,000+ candidate names.
            </p>
          </div>
          <div className="text-muted-foreground flex gap-6 text-xs">
            <span>8 strategies</span>
            <span>·</span>
            <span>13 scoring dimensions</span>
            <span>·</span>
            <span>Brand identities</span>
          </div>
        </div>
      )}

      {/* Generating state */}
      {isPending && (
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="relative grid size-10 place-items-center">
              <div className="bg-labs-blue/20 absolute inset-0 animate-ping rounded-full" />
              <Sparkles className="text-labs-blue size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Generating brands</p>
              <p className="text-muted-foreground text-xs">Engine running…</p>
            </div>
            <span className="text-labs-blue ml-auto text-sm font-semibold tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-labs-blue h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-muted-foreground text-center text-xs">
            {progressLabel}
          </p>
        </div>
      )}

      {/* Results summary */}
      {!isPending && results && (
        <div className="animate-fade-in w-full max-w-lg space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
              Generation Complete
            </p>
            <h3 className="text-foreground mt-1 text-3xl font-bold tabular-nums">
              {results.stats.aboveThreshold.toLocaleString()}
            </h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              candidates above quality threshold
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Sparkles}
              label="Generated"
              value={results.stats.totalGenerated.toLocaleString()}
              sub="raw candidates"
            />
            <StatCard
              icon={Filter}
              label="After filters"
              value={results.stats.afterFilters.toLocaleString()}
              sub="quality passed"
            />
            <StatCard
              icon={BarChart3}
              label="Scored above 65"
              value={results.stats.aboveThreshold.toLocaleString()}
              sub="investor grade"
            />
            <StatCard
              icon={Trophy}
              label="Top score"
              value={`${results.winner?.score.toFixed(1) ?? '—'}/100`}
              sub={results.winner?.name ?? '—'}
            />
          </div>

          {/* By strategy breakdown */}
          <div className="border-border bg-card rounded-lg border p-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium">
              By Strategy
            </p>
            <div className="space-y-1.5">
              {Object.entries(results.stats.byStrategy)
                .sort(([, a], [, b]) => b - a)
                .map(([strategy, count]) => {
                  const max = Math.max(
                    ...Object.values(results.stats.byStrategy),
                  );
                  const pct = (count / max) * 100;
                  const labels: Record<string, string> = {
                    invented: 'Invented',
                    latin: 'Latin',
                    greek: 'Greek',
                    phonetic: 'Phonetic',
                    meaning: 'Meaning',
                    technology: 'Tech',
                    minimal: 'Minimal',
                    oneword: 'One-Word',
                  };
                  return (
                    <div key={strategy} className="flex items-center gap-3">
                      <span className="text-muted-foreground w-20 text-right text-xs">
                        {labels[strategy] ?? strategy}
                      </span>
                      <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-labs-blue/60 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {results.winner && (
            <div className="border-labs-blue/30 rounded-lg border bg-blue-950/10 p-4">
              <p className="text-labs-blue text-xs font-medium uppercase tracking-widest">
                Winner
              </p>
              <p className="text-foreground mt-1 font-mono text-2xl font-bold tracking-widest">
                {results.winner.name.toUpperCase()}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {results.winner.identity.taglines[0]}
              </p>
              <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                <span>
                  Score:{' '}
                  <strong className="text-foreground">
                    {results.winner.score.toFixed(1)}
                  </strong>
                  /100
                </span>
                <span>·</span>
                <span>
                  Confidence:{' '}
                  <strong className="text-foreground">
                    {results.winner.identity.confidence}%
                  </strong>
                </span>
                <span>·</span>
                <span
                  className={cn(
                    'font-medium',
                    results.winner.identity.trademarkRisk === 'low'
                      ? 'text-emerald-400'
                      : results.winner.identity.trademarkRisk === 'medium'
                        ? 'text-amber-400'
                        : 'text-red-400',
                  )}
                >
                  {results.winner.identity.trademarkRisk.toUpperCase()} risk
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
