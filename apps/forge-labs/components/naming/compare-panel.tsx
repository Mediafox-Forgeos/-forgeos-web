'use client';

import type { WebCandidateFull } from '@mediafox/naming-engine';
import { Button } from '@/components/ui/button';
import { ScoreBar } from './score-bar';
import { X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const COMPARE_DIMENSIONS = [
  { key: 'final', label: 'Final Score' },
  { key: 'originality', label: 'Originality' },
  { key: 'brandStrength', label: 'Brand Strength' },
  { key: 'memorability', label: 'Memorability' },
  { key: 'pronunciation', label: 'Pronunciation' },
  { key: 'domainAvailability', label: 'Domain' },
  { key: 'trademarkSafety', label: 'Trademark' },
  { key: 'premiumPerception', label: 'Premium' },
  { key: 'innovationPerception', label: 'Innovation' },
] as const;

interface ComparePanelProps {
  candidates: WebCandidateFull[];
  onClose: () => void;
  onRemove: (name: string) => void;
}

export function ComparePanel({
  candidates,
  onClose,
  onRemove,
}: ComparePanelProps) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">
          No candidates selected for comparison.
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-1 flex-col">
      {/* Header */}
      <div className="border-border flex h-14 items-center justify-between border-b px-6">
        <h2 className="text-sm font-semibold">Comparison Matrix</h2>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {candidates.length} brands
          </span>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Names header row */}
        <div
          className="mb-6 grid gap-4"
          style={{
            gridTemplateColumns: `160px repeat(${candidates.length}, 1fr)`,
          }}
        >
          <div />
          {candidates.map((c) => (
            <div key={c.name} className="relative text-center">
              <button
                className="text-muted-foreground hover:text-foreground absolute -right-1 -top-1 rounded-full p-0.5 transition-colors"
                onClick={() => onRemove(c.name)}
                title="Remove"
              >
                <Minus className="size-3" />
              </button>
              <p className="text-foreground font-mono text-lg font-bold tracking-widest">
                {c.name.toUpperCase()}
              </p>
              <p className="text-muted-foreground text-xs capitalize">
                {c.strategy}
              </p>
            </div>
          ))}
        </div>

        {/* Score matrix */}
        <div className="space-y-1">
          {COMPARE_DIMENSIONS.map(({ key, label }, rowIndex) => {
            const values = candidates.map((c) => {
              if (key === 'final') return c.score;
              return (c.scores as Record<string, number>)[key] ?? 0;
            });
            const maxVal = Math.max(...values);

            return (
              <div
                key={key}
                className={cn(
                  'grid items-center gap-4 rounded-md px-2 py-1.5',
                  rowIndex % 2 === 0 ? 'bg-card/50' : '',
                )}
                style={{
                  gridTemplateColumns: `160px repeat(${candidates.length}, 1fr)`,
                }}
              >
                <span className="text-muted-foreground text-xs">{label}</span>
                {values.map((val, i) => (
                  <div
                    key={candidates[i].name}
                    className={cn(
                      'flex justify-center',
                      val === maxVal
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    <ScoreBar
                      value={val}
                      size="sm"
                      className={cn(
                        val === maxVal ? 'opacity-100' : 'opacity-60',
                      )}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Trademark risk row */}
        <div
          className="bg-card/50 mt-4 grid items-center gap-4 rounded-md px-2 py-1.5"
          style={{
            gridTemplateColumns: `160px repeat(${candidates.length}, 1fr)`,
          }}
        >
          <span className="text-muted-foreground text-xs">TM Risk</span>
          {candidates.map((c) => (
            <div key={c.name} className="flex justify-center">
              <span
                className={cn(
                  'text-xs font-medium',
                  c.identity.trademarkRisk === 'low'
                    ? 'text-emerald-400'
                    : c.identity.trademarkRisk === 'medium'
                      ? 'text-amber-400'
                      : 'text-red-400',
                )}
              >
                {c.identity.trademarkRisk.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Founder notes */}
        <div className="mt-8 space-y-3">
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Founder Notes
          </h3>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${candidates.length}, 1fr)` }}
          >
            {candidates.map((c) => (
              <div key={c.name}>
                <p className="mb-1 text-xs font-medium">
                  {c.name.toUpperCase()}
                </p>
                <textarea
                  className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:ring-ring h-24 w-full resize-none rounded-md border px-3 py-2 text-xs focus:outline-none focus:ring-1"
                  placeholder="Add notes..."
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
