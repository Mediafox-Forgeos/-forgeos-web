import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScoreBar } from './score-bar';
import { GitCompare, Star } from 'lucide-react';
import type { WebCandidate } from '@mediafox/naming-engine';

const strategyLabel: Record<string, string> = {
  invented: 'Invented',
  latin: 'Latin',
  greek: 'Greek',
  phonetic: 'Phonetic',
  meaning: 'Meaning',
  technology: 'Tech',
  minimal: 'Minimal',
  oneword: 'One-Word',
};

const strategyVariant: Record<
  string,
  'blue' | 'violet' | 'outline' | 'default'
> = {
  invented: 'default',
  latin: 'outline',
  greek: 'violet',
  phonetic: 'blue',
  meaning: 'default',
  technology: 'blue',
  minimal: 'outline',
  oneword: 'violet',
};

interface CandidateCardProps {
  candidate: WebCandidate;
  rank: number;
  isSelected: boolean;
  isInCompare: boolean;
  onSelect: () => void;
  onToggleCompare: () => void;
}

export function CandidateCard({
  candidate,
  rank,
  isSelected,
  isInCompare,
  onSelect,
  onToggleCompare,
}: CandidateCardProps) {
  const isWinner = rank === 1;

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-all',
        isSelected
          ? 'border-ring bg-accent'
          : 'border-border bg-card hover:border-border/80 hover:bg-accent/50',
        isWinner && !isSelected && 'border-labs-blue/30 bg-blue-950/10',
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-label={`View analysis for ${candidate.name}`}
    >
      {/* Rank + Name */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-6 text-right text-xs tabular-nums">
          {rank}
        </span>
        <span
          className={cn(
            'flex-1 font-mono text-base font-semibold tracking-wider',
            isWinner ? 'text-labs-blue' : 'text-foreground',
          )}
        >
          {candidate.name.toUpperCase()}
        </span>
        {isWinner && (
          <Star
            className="fill-labs-blue text-labs-blue size-3.5"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Strategy + Score */}
      <div className="flex items-center gap-2 pl-8">
        <Badge
          variant={strategyVariant[candidate.strategy] ?? 'default'}
          className="text-[10px]"
        >
          {strategyLabel[candidate.strategy] ?? candidate.strategy}
        </Badge>
        <div className="flex-1" />
        <ScoreBar value={candidate.score} size="sm" />
      </div>

      {/* Compare toggle */}
      <button
        className={cn(
          'absolute right-2 top-2 rounded p-1 opacity-0 transition-all group-hover:opacity-100',
          isInCompare
            ? 'text-labs-blue opacity-100'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompare();
        }}
        title={isInCompare ? 'Remove from comparison' : 'Add to comparison'}
        aria-label={
          isInCompare ? 'Remove from comparison' : 'Add to comparison'
        }
      >
        <GitCompare className="size-3.5" />
      </button>
    </div>
  );
}
