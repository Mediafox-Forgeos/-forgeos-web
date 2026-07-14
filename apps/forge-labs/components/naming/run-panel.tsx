'use client';

import type { WebNamingResult } from '@mediafox/naming-engine';
import { Sparkles, TrendingUp, Filter, BarChart3, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RunPanelProps {
  isPending: boolean;
  progress: number;
  progressLabel: string;
  results: WebNamingResult | null;
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function RunPanel({ isPending, progress, progressLabel, results }: RunPanelProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10">
      {/* Empty state */}
      {!isPending && !results && (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="grid size-16 place-items-center rounded-2xl border border-border bg-muted">
            <Sparkles className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Ready to generate</h3>
            <p className="mt-1 text-sm text-muted-foreground text-balance">
              Fill in the project parameters and click{' '}
              <span className="text-foreground font-medium">Generate Brands</span> to run the
              engine across 50,000+ candidate names.
            </p>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground">
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
              <div className="absolute inset-0 animate-ping rounded-full bg-labs-blue/20" />
              <Sparkles className="size-5 text-labs-blue" />
            </div>
            <div>
              <p className="text-sm font-medium">Generating brands</p>
              <p className="text-xs text-muted-foreground">Engine running…</p>
            </div>
            <span className="ml-auto text-sm font-semibold tabular-nums text-labs-blue">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-labs-blue transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">{progressLabel}</p>
        </div>
      )}

      {/* Results summary */}
      {!isPending && results && (
        <div className="w-full max-w-lg animate-fade-in space-y-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Generation Complete
            </p>
            <h3 className="mt-1 text-3xl font-bold tabular-nums text-foreground">
              {results.stats.aboveThreshold.toLocaleString()}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
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
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">By Strategy</p>
            <div className="space-y-1.5">
              {Object.entries(results.stats.byStrategy)
                .sort(([, a], [, b]) => b - a)
                .map(([strategy, count]) => {
                  const max = Math.max(...Object.values(results.stats.byStrategy));
                  const pct = (count / max) * 100;
                  const labels: Record<string, string> = {
                    invented: 'Invented', latin: 'Latin', greek: 'Greek',
                    phonetic: 'Phonetic', meaning: 'Meaning', technology: 'Tech',
                    minimal: 'Minimal', oneword: 'One-Word',
                  };
                  return (
                    <div key={strategy} className="flex items-center gap-3">
                      <span className="w-20 text-right text-xs text-muted-foreground">
                        {labels[strategy] ?? strategy}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-muted h-1">
                        <div
                          className="h-full rounded-full bg-labs-blue/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {results.winner && (
            <div className="rounded-lg border border-labs-blue/30 bg-blue-950/10 p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-labs-blue">
                Winner
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-foreground">
                {results.winner.name.toUpperCase()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {results.winner.identity.taglines[0]}
              </p>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Score: <strong className="text-foreground">{results.winner.score.toFixed(1)}</strong>/100</span>
                <span>·</span>
                <span>Confidence: <strong className="text-foreground">{results.winner.identity.confidence}%</strong></span>
                <span>·</span>
                <span className={cn(
                  'font-medium',
                  results.winner.identity.trademarkRisk === 'low' ? 'text-emerald-400' :
                  results.winner.identity.trademarkRisk === 'medium' ? 'text-amber-400' : 'text-red-400'
                )}>
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
