'use client';

import {
  ArrowUp,
  BookmarkPlus,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { askFoxyAction, saveLearningAction } from '@/app/(app)/foxy-actions';
import { cn } from '@/lib/cn';
import type { AskAnswer, IntelMeta } from '@/lib/intel/schema';
import { AreaTrend } from './charts-client';
import { FindingCard } from './intel-findings';

/* Componentes interactivos de Foxy Intelligence (DS V2 · addendum §6–§9). */

/** Copy expandible y contraíble, con peso tipográfico normal (addendum §10A). */
export function ExpandableCopy({
  text,
  lines = 6,
}: {
  text: string | null;
  lines?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!text)
    return (
      <p className="text-muted-foreground text-sm italic">
        Publicación sin texto.
      </p>
    );
  const long = text.length > 280 || text.split('\n').length > lines;
  return (
    <div>
      <p
        className={cn(
          'whitespace-pre-line text-[15px] font-normal leading-relaxed',
          !open && long && 'line-clamp-6',
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-primary-text mt-1.5 inline-flex items-center gap-1 text-sm font-extrabold"
        >
          {open ? 'Ver menos' : 'Ver todo el texto'}
          <ChevronDown
            aria-hidden
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </button>
      )}
    </div>
  );
}

export interface TimelineSeries {
  key: string;
  label: string;
  unit: string;
  points: Array<{ label: string; value: number; at: string }>;
}

/**
 * Evolución histórica con selector de métrica. Solo mediciones reales (sin interpolar); con
 * una sola medición muestra el estado correspondiente; sin variación, lo dice.
 */
export function PerformanceTimeline({ series }: { series: TimelineSeries[] }) {
  const usable = series.filter((s) => s.points.length > 0);
  const [key, setKey] = useState(usable[0]?.key ?? '');
  const cur = usable.find((s) => s.key === key) ?? usable[0];
  if (!cur)
    return (
      <p className="text-muted-foreground text-sm">Sin mediciones todavía.</p>
    );
  const first = cur.points[0]!.value;
  const last = cur.points[cur.points.length - 1]!.value;
  const diff = last - first;
  return (
    <div>
      <div
        role="group"
        aria-label="Métrica de la evolución"
        className="flex flex-wrap gap-1.5"
      >
        {usable.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === cur.key}
            onClick={() => setKey(s.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-extrabold',
              s.key === cur.key
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-border hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {cur.points.length < 2 ? (
          <div className="border-border text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm">
            <CircleDashed aria-hidden className="h-4 w-4" />
            Una sola medición ({cur.points[0]!.label}):{' '}
            {cur.points[0]!.value.toLocaleString('es-CO')} {cur.unit}. La
            evolución aparece con la próxima sincronización.
          </div>
        ) : (
          <>
            <AreaTrend
              height={190}
              unit={cur.unit}
              points={cur.points.map((p) => ({
                label: p.label,
                value: p.value,
              }))}
            />
            <p className="text-muted-foreground mt-2 text-xs">
              {diff === 0
                ? `Sin variación entre ${cur.points.length} mediciones.`
                : `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${cur.unit} entre la primera y la última de ${cur.points.length} mediciones.`}{' '}
              Solo mediciones reales; no se interpolan puntos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

type Turn = { q: string; a?: AskAnswer; meta?: IntelMeta; error?: string };

/** Ask Foxy contextual: preguntas sugeridas + consulta libre; respuestas con evidencia. */
export function AskFoxyContextual({
  postId,
  period,
  platform,
  suggestions,
  scopeLabel,
  postHrefPattern,
}: {
  postId: string | null;
  period: string;
  platform?: string | null;
  suggestions: readonly string[];
  scopeLabel: string;
  /** Patrón del enlace a una publicación citada como evidencia («{id}» se sustituye). */
  postHrefPattern: string;
}) {
  const postHref = (id: string) =>
    postHrefPattern.replace('{id}', encodeURIComponent(id));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const ask = (question: string) => {
    if (!question.trim() || pending) return;
    setQ('');
    setTurns((t) => [...t, { q: question }]);
    start(async () => {
      const r = await askFoxyAction({ question, postId, period, platform });
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] =
          'error' in r
            ? { q: question, error: r.error }
            : { q: question, a: r.answer, meta: r.meta };
        return next;
      });
    });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };
  return (
    <section
      aria-labelledby="ask-foxy-title"
      className="rounded-card border-ai-fg/20 shadow-card border bg-gradient-to-br from-[hsl(var(--ai-bg))] to-[hsl(var(--card))] p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="ask-foxy-title"
            className="flex items-center gap-2 text-base font-extrabold"
          >
            <Sparkles aria-hidden className="text-ai-fg h-5 w-5" /> Pregúntale a
            Foxy
          </h2>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            Contexto: {scopeLabel}
          </p>
        </div>
        <span className="bg-card text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-bold">
          Motor local por reglas · sin IA generativa
        </span>
      </header>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => ask(s)}
            className="bg-card hover:border-ai-fg/40 border-border rounded-full border px-3 py-1.5 text-left text-xs font-bold disabled:opacity-60"
          >
            {s}
          </button>
        ))}
      </div>
      {turns.length > 0 && (
        <ol className="mt-4 space-y-4" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className="space-y-2">
              <p className="bg-brand text-brand-foreground ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm font-bold">
                {t.q}
              </p>
              {!t.a && !t.error && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />{' '}
                  Foxy está analizando…
                </p>
              )}
              {t.error && (
                <p className="text-critical-fg text-sm font-bold">{t.error}</p>
              )}
              {t.a && (
                <div className="space-y-2">
                  {t.a.unanswerable && (
                    <p className="bg-card border-border rounded-xl border p-3 text-sm">
                      {t.a.unanswerable}
                    </p>
                  )}
                  {t.a.findings.map((f, j) => (
                    <FindingCard key={j} f={f} postHref={postHref} compact />
                  ))}
                  {t.meta?.syntheticInput && (
                    <p className="text-warning-fg text-xs font-bold">
                      Datos sintéticos de prueba: no describen una marca real.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
        <label htmlFor={`ask-${postId ?? 'brand'}`} className="sr-only">
          Pregunta para Foxy
        </label>
        <textarea
          id={`ask-${postId ?? 'brand'}`}
          rows={1}
          maxLength={500}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(q);
            }
          }}
          placeholder="Pregúntale lo que quieras a Foxy..."
          className="bg-card border-border focus-visible:ring-primary-text min-h-[44px] flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending || q.trim().length < 3}
          className="bg-brand text-brand-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
          aria-label="Enviar pregunta"
        >
          {pending ? (
            <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" />
          ) : (
            <Send aria-hidden className="h-5 w-5" />
          )}
        </button>
      </form>
    </section>
  );
}

/**
 * Acciones derivadas de un hallazgo. Solo «Guardar como aprendizaje» ejecuta algo (propuesta
 * para validación humana en Foxy Brand Brain). Las demás se muestran como próximas
 * capacidades, deshabilitadas: no simulan funcionar.
 */
export function RecommendationAction({
  title,
  body,
  postId,
  canSave,
  saveDisabledReason,
}: {
  title: string;
  body: string;
  postId: string | null;
  canSave: boolean;
  saveDisabledReason?: string;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>(
    'idle',
  );
  const save = async () => {
    setState('saving');
    const r = await saveLearningAction({ title, body, postId });
    setState('error' in r ? r.error : 'saved');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={!canSave || state === 'saving' || state === 'saved'}
        onClick={save}
        title={!canSave ? saveDisabledReason : undefined}
        className="border-border hover:bg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold disabled:opacity-60"
      >
        <BookmarkPlus aria-hidden className="h-3.5 w-3.5" />
        {state === 'saved'
          ? 'Propuesto como aprendizaje'
          : state === 'saving'
            ? 'Guardando…'
            : 'Guardar como aprendizaje'}
      </button>
      {state !== 'idle' && state !== 'saving' && state !== 'saved' && (
        <span className="text-critical-fg text-[11px] font-bold">{state}</span>
      )}
      {!canSave && saveDisabledReason && (
        <span className="text-muted-foreground text-[11px]">
          {saveDisabledReason}
        </span>
      )}
    </div>
  );
}

export function ScrollTopHint() {
  return (
    <a
      href="#top"
      className="text-primary-text inline-flex items-center gap-1 text-xs font-bold"
    >
      <ArrowUp aria-hidden className="h-3.5 w-3.5" /> Volver arriba
    </a>
  );
}
