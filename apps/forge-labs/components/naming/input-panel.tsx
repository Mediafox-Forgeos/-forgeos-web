'use client';

import { useState } from 'react';
import type { EngineInput } from '@mediafox/naming-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { PERSONALITY_OPTIONS, DOMAIN_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/default-input';

interface InputPanelProps {
  input: EngineInput;
  onChange: (input: EngineInput) => void;
  onGenerate: () => void;
  isPending: boolean;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function InputPanel({ input, onChange, onGenerate, isPending }: InputPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function update<K extends keyof EngineInput>(key: K, value: EngineInput[K]) {
    onChange({ ...input, [key]: value });
  }

  function togglePersonality(p: string) {
    const list = input.brandPersonality;
    update('brandPersonality', list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  }

  function toggleLanguage(l: string) {
    const list = input.languages;
    update('languages', list.includes(l) ? list.filter((x) => x !== l) : [...list, l]);
  }

  function toggleDomain(d: string) {
    const list = input.targetDomains;
    update('targetDomains', list.includes(d) ? list.filter((x) => x !== d) : [...list, d]);
  }

  const canGenerate = input.industry.trim().length > 0 && !isPending;

  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-border">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <h2 className="text-sm font-semibold">Project Parameters</h2>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <Field label="Industry *" hint="What market or category is this brand for?">
          <Input
            placeholder="e.g. AI SaaS for EV Infrastructure"
            value={input.industry}
            onChange={(e) => update('industry', e.target.value)}
            disabled={isPending}
          />
        </Field>

        <Field label="Keywords" hint="Comma-separated concepts the name should evoke">
          <Textarea
            placeholder="Mobility, Intelligence, Scale, Speed..."
            value={input.keywords.join(', ')}
            onChange={(e) =>
              update(
                'keywords',
                e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
              )
            }
            disabled={isPending}
            rows={3}
          />
        </Field>

        <Field label="Brand Personality">
          <div className="flex flex-wrap gap-1.5">
            {PERSONALITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => togglePersonality(p)}
                disabled={isPending}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  input.brandPersonality.includes(p)
                    ? 'border-ring bg-ring/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border/70 hover:text-foreground',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Languages">
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                disabled={isPending}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  input.languages.includes(l)
                    ? 'border-ring bg-ring/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border/70 hover:text-foreground',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>

        {/* Advanced toggle */}
        <button
          className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Advanced settings
        </button>

        {advancedOpen && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min length">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={input.lengthConstraints.min}
                  onChange={(e) =>
                    update('lengthConstraints', {
                      ...input.lengthConstraints,
                      min: Number(e.target.value),
                    })
                  }
                  disabled={isPending}
                />
              </Field>
              <Field label="Max length">
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={input.lengthConstraints.max}
                  onChange={(e) =>
                    update('lengthConstraints', {
                      ...input.lengthConstraints,
                      max: Number(e.target.value),
                    })
                  }
                  disabled={isPending}
                />
              </Field>
            </div>

            <Field label="Forbidden words" hint="Space-separated words to exclude">
              <Input
                placeholder="EV Charge Volt Grid..."
                value={input.forbidden.words.join(' ')}
                onChange={(e) =>
                  update('forbidden', {
                    ...input.forbidden,
                    words: e.target.value.split(/\s+/).filter(Boolean),
                  })
                }
                disabled={isPending}
              />
            </Field>

            <Field label="Forbidden suffixes" hint="e.g. -ion -ify -ova">
              <Input
                placeholder="-ion -ova -ify..."
                value={input.forbidden.suffixes.join(' ')}
                onChange={(e) =>
                  update('forbidden', {
                    ...input.forbidden,
                    suffixes: e.target.value.split(/\s+/).filter(Boolean),
                  })
                }
                disabled={isPending}
              />
            </Field>

            <Field label="Target domains">
              <div className="flex flex-wrap gap-1.5">
                {DOMAIN_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDomain(d)}
                    disabled={isPending}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors',
                      input.targetDomains.includes(d)
                        ? 'border-ring bg-ring/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-border/70 hover:text-foreground',
                    )}
                  >
                    .{d}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="border-t border-border p-4">
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate Brands
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {isPending ? 'Processing 50,000+ candidates...' : '⌘↵ to generate'}
        </p>
      </div>
    </div>
  );
}
