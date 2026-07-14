'use client';

import { useState, useTransition, useEffect } from 'react';
import type { EngineInput } from '@mediafox/naming-engine';
import type { WebNamingResult, WebCandidateFull } from '@mediafox/naming-engine';
import { generateNames } from '@/actions/naming';
import { InputPanel } from '@/components/naming/input-panel';
import { RunPanel } from '@/components/naming/run-panel';
import { ResultsPanel } from '@/components/naming/results-panel';
import { CandidateDetail } from '@/components/naming/candidate-detail';
import { ComparePanel } from '@/components/naming/compare-panel';
import { FounderReview } from '@/components/naming/founder-review';
import { defaultInput } from '@/lib/default-input';
import type { FounderReviewData } from '@/lib/session';

type CenterView = 'run' | 'detail' | 'compare' | 'founder';

const PROGRESS_STAGES: Array<[number, string, number]> = [
  [12, 'Initializing generation strategies...', 400],
  [28, 'Generating 50,000+ candidates across 8 strategies...', 900],
  [48, 'Applying phonetic and quality filters...', 1500],
  [66, 'Scoring all candidates across 13 dimensions...', 2200],
  [80, 'Validating top candidates...', 3000],
  [91, 'Building brand identities...', 3700],
];

export function NamingClient() {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState<EngineInput>(defaultInput);
  const [results, setResults] = useState<WebNamingResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [compareNames, setCompareNames] = useState<string[]>([]);
  const [centerView, setCenterView] = useState<CenterView>('run');
  const [founderReviews, setFounderReviews] = useState<Record<string, FounderReviewData>>({});

  // Animate progress while generating
  useEffect(() => {
    if (!isPending) {
      if (results) {
        setProgress(100);
        setProgressLabel('Generation complete.');
      }
      return;
    }

    setProgress(5);
    setProgressLabel('Starting engine...');

    const timers = PROGRESS_STAGES.map(([pct, label, delay]) =>
      setTimeout(() => {
        setProgress(pct);
        setProgressLabel(label);
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [isPending, results]);

  // Keyboard shortcut: ⌘↵ to generate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isPending && input.industry.trim()) {
        handleGenerate();
      }
      if (e.key === 'Escape' && centerView !== 'run') {
        setCenterView('run');
        setSelectedName(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function handleGenerate() {
    setResults(null);
    setCenterView('run');
    setSelectedName(null);
    startTransition(async () => {
      const result = await generateNames(input);
      setResults(result);
    });
  }

  function handleSelectCandidate(name: string) {
    setSelectedName(name);
    setCenterView('detail');
  }

  function handleToggleCompare(name: string) {
    setCompareNames((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length < 5
          ? [...prev, name]
          : prev,
    );
  }

  function handleSaveFounderReview(name: string, review: FounderReviewData) {
    setFounderReviews((prev) => ({ ...prev, [name]: review }));
  }

  const selectedData: WebCandidateFull | null =
    (selectedName ? results?.top10.find((c) => c.name === selectedName) : null) ?? null;

  const compareData: WebCandidateFull[] =
    results?.top10.filter((c) => compareNames.includes(c.name)) ?? [];

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Left: Input form */}
      <InputPanel
        input={input}
        onChange={setInput}
        onGenerate={handleGenerate}
        isPending={isPending}
      />

      {/* Center: Context panel */}
      {centerView === 'run' && (
        <RunPanel
          isPending={isPending}
          progress={progress}
          progressLabel={progressLabel}
          results={results}
        />
      )}

      {centerView === 'detail' && selectedName && (
        <CandidateDetail
          name={selectedName}
          data={selectedData}
          onClose={() => setCenterView('run')}
          onFounderReview={() => setCenterView('founder')}
          onAddToCompare={() => handleToggleCompare(selectedName)}
          isInCompare={compareNames.includes(selectedName)}
        />
      )}

      {centerView === 'compare' && (
        <ComparePanel
          candidates={compareData}
          onClose={() => setCenterView('run')}
          onRemove={(name) => {
            setCompareNames((prev) => prev.filter((n) => n !== name));
            if (compareNames.length <= 1) setCenterView('run');
          }}
        />
      )}

      {centerView === 'founder' && selectedName && (
        <FounderReview
          name={selectedName}
          data={selectedData}
          initialReview={founderReviews[selectedName]}
          onClose={() => setCenterView('detail')}
          onSave={handleSaveFounderReview}
        />
      )}

      {/* Right: Results list */}
      <ResultsPanel
        results={results}
        isPending={isPending}
        selectedName={selectedName}
        compareNames={compareNames}
        onSelect={handleSelectCandidate}
        onToggleCompare={handleToggleCompare}
        onOpenCompare={() => setCenterView('compare')}
      />
    </div>
  );
}
