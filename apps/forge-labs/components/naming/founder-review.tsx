'use client';

import { useState } from 'react';
import type { WebCandidateFull } from '@mediafox/naming-engine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, Star } from 'lucide-react';
import type { FounderReviewData } from '@/lib/session';
import { computeFounderScore } from '@/lib/session';

interface FounderReviewProps {
  name: string;
  data: WebCandidateFull | null;
  onClose: () => void;
  onSave?: (name: string, review: FounderReviewData) => void;
}

const QUESTIONS: Array<{ key: keyof Omit<FounderReviewData, 'notes' | 'founderScore'>; label: string }> = [
  { key: 'wouldInvest', label: 'Would you invest in a company with this name?' },
  { key: 'wouldRemember', label: 'Would you remember this name in 24 hours?' },
  { key: 'imagineNasdaq', label: 'Can you imagine this on Nasdaq?' },
  { key: 'wouldAnnounce', label: 'Would you be proud to announce it publicly?' },
  { key: 'billionDollar', label: 'Could this become a billion-dollar brand?' },
];

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'size-6',
              n <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function FounderReview({ name, data, onClose, onSave }: FounderReviewProps) {
  const [review, setReview] = useState<Omit<FounderReviewData, 'founderScore'>>({
    wouldInvest: 0,
    wouldRemember: 0,
    imagineNasdaq: 0,
    wouldAnnounce: 0,
    billionDollar: 0,
    notes: '',
  });

  const algorithmScore = data?.score ?? 0;
  const founderScore = computeFounderScore({ ...review, founderScore: 0 });
  const allAnswered = QUESTIONS.every((q) => review[q.key] > 0);

  function updateField<K extends keyof typeof review>(key: K, value: (typeof review)[K]) {
    setReview((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave?.(name, { ...review, founderScore });
    onClose();
  }

  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-6">
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">Founder Review</h2>
        <span className="font-mono text-sm font-bold text-muted-foreground">
          — {name.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Score comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Algorithm Score
            </p>
            <p className="text-3xl font-bold tabular-nums text-labs-blue">
              {algorithmScore.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">13 dimensions · objective</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Founder Score
            </p>
            <p className={cn(
              'text-3xl font-bold tabular-nums',
              allAnswered ? 'text-amber-400' : 'text-muted-foreground',
            )}>
              {allAnswered ? founderScore : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">5 questions · gut feel</p>
          </div>
        </div>

        <div className="rounded-md border border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <p className="text-xs text-amber-400">
            These scores are intentionally kept separate. The algorithm measures phonetics and
            brand mechanics. The founder measures vision and conviction.
          </p>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {QUESTIONS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <p className="text-sm font-medium">{label}</p>
              <StarRating
                value={review[key]}
                onChange={(v) => updateField(key, v)}
              />
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Notes</p>
          <textarea
            className="h-24 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Any gut feelings, associations, or concerns..."
            value={review.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!allAnswered}
          onClick={handleSave}
        >
          Save Founder Score
        </Button>
      </div>
    </div>
  );
}
