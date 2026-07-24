'use client';

import type { WebNamingResult } from '@mediafox/naming-engine';
import { CandidateCard } from './candidate-card';
import { Button } from '@/components/ui/button';
import { GitCompare, LayoutList } from 'lucide-react';

interface ResultsPanelProps {
  results: WebNamingResult | null;
  isPending: boolean;
  selectedName: string | null;
  compareNames: string[];
  onSelect: (name: string) => void;
  onToggleCompare: (name: string) => void;
  onOpenCompare: () => void;
}

export function ResultsPanel({
  results,
  isPending,
  selectedName,
  compareNames,
  onSelect,
  onToggleCompare,
  onOpenCompare,
}: ResultsPanelProps) {
  const candidates = results?.top25 ?? [];

  return (
    <div className="border-border flex w-80 shrink-0 flex-col border-l">
      {/* Header */}
      <div className="border-border flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <LayoutList className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">Top Candidates</h2>
          {results && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] tabular-nums">
              {Math.min(25, results.stats.aboveThreshold)}
            </span>
          )}
        </div>
        {compareNames.length >= 2 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenCompare}
            className="h-7 gap-1.5 text-xs"
          >
            <GitCompare className="size-3" />
            Compare ({compareNames.length})
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {/* Skeleton loading */}
        {isPending && (
          <div className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-16 animate-pulse rounded-lg"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isPending && candidates.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No results yet. Generate brands to see candidates here.
            </p>
          </div>
        )}

        {/* Candidate cards */}
        {!isPending &&
          candidates.map((candidate, i) => (
            <CandidateCard
              key={candidate.name}
              candidate={candidate}
              rank={i + 1}
              isSelected={selectedName === candidate.name}
              isInCompare={compareNames.includes(candidate.name)}
              onSelect={() => onSelect(candidate.name)}
              onToggleCompare={() => onToggleCompare(candidate.name)}
            />
          ))}
      </div>

      {/* Footer hint */}
      {candidates.length > 0 && (
        <div className="border-border border-t px-4 py-2">
          <p className="text-muted-foreground text-[11px]">
            Click a card to see full analysis ·{' '}
            <GitCompare className="inline size-3" /> to compare
          </p>
        </div>
      )}
    </div>
  );
}
