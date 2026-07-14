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
    <div className="flex w-80 shrink-0 flex-col border-l border-border">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <LayoutList className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Top Candidates</h2>
          {results && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              {Math.min(25, results.stats.aboveThreshold)}
            </span>
          )}
        </div>
        {compareNames.length >= 2 && (
          <Button size="sm" variant="outline" onClick={onOpenCompare} className="gap-1.5 h-7 text-xs">
            <GitCompare className="size-3" />
            Compare ({compareNames.length})
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* Skeleton loading */}
        {isPending && (
          <div className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg bg-muted"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isPending && candidates.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center py-12">
            <p className="text-sm text-muted-foreground">
              No results yet. Generate brands to see candidates here.
            </p>
          </div>
        )}

        {/* Candidate cards */}
        {!isPending && candidates.map((candidate, i) => (
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
        <div className="border-t border-border px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            Click a card to see full analysis · <GitCompare className="inline size-3" /> to compare
          </p>
        </div>
      )}
    </div>
  );
}
