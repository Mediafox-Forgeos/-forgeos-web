'use client';

import {
  ArrowUp,
  BookmarkPlus,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  Send,
  Sparkles,
  Square,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { saveLearningAction } from '@/app/(app)/foxy-actions';
import { cn } from '@/lib/cn';
import type { GenAnswer, GenAnswerDraft } from '@/lib/intel/ai/answer';
import type { GenMeta } from '@/lib/intel/ai/engine';
import type { AskAnswer, IntelMeta } from '@/lib/intel/schema';
import {
  AdjustmentsNote,
  AiStateNotice,
  EngineBadge,
  FallbackNotice,
  MetaBadge,
  type EngineBadgeState,
} from './ai-engine';
import { AreaTrend } from './charts-client';
import { EvidenceDisclosure, FindingCard } from './intel-findings';

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

export type TurnStatus =
  'pending' | 'streaming' | 'done' | 'error' | 'cancelled';
export type Turn = {
  id?: string;
  q: string;
  status: TurnStatus;
  /** Respuesta del motor local por reglas (o de respaldo). */
  a?: AskAnswer;
  /** Respuesta generativa validada (o simulada con fixtures, siempre identificada). */
  gen?: GenAnswer;
  /** Secciones parciales mientras llega el flujo. */
  draft?: GenAnswerDraft;
  meta?: GenMeta | IntelMeta;
  error?: string;
};

export interface FoxyScope {
  postId: string | null;
  period: string;
  platform?: string | null;
  /** Pantalla y alcance legibles (marca · red · formato · periodo · filtros). */
  scopeLabel?: string;
  filters?: string[];
}

const isGenMeta = (m: Turn['meta']): m is GenMeta =>
  !!m && 'state' in m && 'modelLabel' in m;

/** Texto plano ya mostrado de un turno (para dar continuidad a la conversación). */
function turnSummary(t: Turn): string {
  if (t.gen)
    return [t.gen.answer, t.gen.interpretation].filter(Boolean).join(' ');
  if (t.a)
    return t.a.unanswerable ?? t.a.headline ?? t.a.findings[0]?.title ?? '';
  return '';
}

const rid = () =>
  globalThis.crypto?.randomUUID?.().replace(/-/g, '') ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * Conversación con Foxy en streaming (WO-HF-AI-ENGINE-001 §7). Cada turno pasa por
 * pending → streaming → done | error | cancelled. El servidor decide el motor (IA
 * generativa autorizada, simulación con fixtures en desarrollo o motor local) y lo declara
 * en cada respuesta. «Detener» cancela la generación (también en el proveedor).
 */
export function useFoxyConversation(scope: FoxyScope, initial: Turn[] = []) {
  const [turns, setTurns] = useState<Turn[]>(initial);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const patch = (id: string, fn: (t: Turn) => Turn) =>
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));

  const ask = (question: string) => {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    const id = rid();
    const history = turnsRef.current
      .filter((t) => t.status === 'done')
      .slice(-4)
      .map((t) => ({ q: t.q, a: turnSummary(t).slice(0, 1_400) }));
    setTurns((t) => [...t, { id, q, status: 'pending' }]);
    setPending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void (async () => {
      try {
        const res = await fetch('/api/foxy/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            question: q,
            postId: scope.postId,
            period: scope.period,
            platform: scope.platform ?? null,
            scopeLabel: scope.scopeLabel ?? 'Marca',
            filters: scope.filters ?? [],
            history,
            requestId: id,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let msg = 'Foxy no pudo responder. Inténtalo de nuevo.';
          try {
            msg = ((await res.json()) as { error?: string }).error ?? msg;
          } catch {
            /* sin cuerpo */
          }
          patch(id, (t) => ({ ...t, status: 'error', error: msg }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let finished = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: AskStreamEvent;
            try {
              ev = JSON.parse(line) as AskStreamEvent;
            } catch {
              continue;
            }
            if (ev.type === 'meta')
              patch(id, (t) => ({ ...t, status: 'streaming', meta: ev.meta }));
            else if (ev.type === 'draft')
              patch(id, (t) => ({
                ...t,
                status: 'streaming',
                draft: ev.draft,
              }));
            else if (ev.type === 'final') {
              finished = true;
              patch(id, (t) => ({
                ...t,
                status: 'done',
                gen: ev.answer,
                draft: undefined,
                meta: ev.meta,
              }));
            } else if (ev.type === 'local') {
              finished = true;
              patch(id, (t) => ({
                ...t,
                status: 'done',
                a: ev.answer,
                draft: undefined,
                meta: ev.meta,
                // Si hubo un error del proveedor, se conserva su aviso junto al respaldo local.
                error: t.error,
              }));
            } else if (ev.type === 'error') {
              patch(id, (t) => ({
                ...t,
                status: ev.code === 'cancelled' ? 'cancelled' : 'error',
                error: ev.message,
              }));
            }
          }
        }
        if (!finished)
          patch(id, (t) =>
            t.status === 'cancelled' || t.status === 'error'
              ? t
              : {
                  ...t,
                  status: 'error',
                  error:
                    'La conexión se cortó antes de terminar: la respuesta quedó incompleta.',
                },
          );
      } catch {
        patch(id, (t) =>
          ctrl.signal.aborted
            ? { ...t, status: 'cancelled', error: 'Generación cancelada.' }
            : {
                ...t,
                status: 'error',
                error:
                  'Sin conexión con Hey Foxy. Revisa tu red e inténtalo de nuevo.',
              },
        );
      } finally {
        abortRef.current = null;
        setPending(false);
      }
    })();
  };
  const cancel = () => abortRef.current?.abort();
  return { turns, ask, pending, setTurns, cancel };
}

type AskStreamEvent =
  | { type: 'meta'; meta: GenMeta }
  | { type: 'draft'; draft: GenAnswerDraft }
  | { type: 'final'; answer: GenAnswer; meta: GenMeta }
  | { type: 'local'; answer: AskAnswer; meta: GenMeta }
  | { type: 'error'; message: string; code: string };

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
    {children}
  </p>
);

/**
 * Respuesta generativa conversacional (DS v0.5 · ConversationalAnswer): respuesta principal,
 * interpretación, evidencias expandibles, recomendaciones, limitaciones y seguimiento. Se
 * muestra por partes mientras llega el flujo.
 */
function FoxyGenAnswer({
  gen,
  draft,
  streaming,
  postHref,
  onFollowUp,
  disabled,
}: {
  gen?: GenAnswer;
  draft?: GenAnswerDraft;
  streaming: boolean;
  postHref: (id: string) => string;
  onFollowUp: (q: string) => void;
  disabled?: boolean;
}) {
  const a = gen ?? draft;
  if (!a) return null;
  const recs = gen ? gen.recommendations : (draft?.recommendations ?? []);
  return (
    <div className="space-y-2.5">
      {a.answer && (
        <p className="text-[15px] leading-relaxed">
          {a.answer}
          {streaming && !a.interpretation && (
            <span
              aria-hidden
              className="bg-ai-fg ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle"
            />
          )}
        </p>
      )}
      {a.interpretation && (
        <p className="text-muted-foreground text-[13.5px] leading-relaxed">
          {a.interpretation}
        </p>
      )}
      {gen && gen.evidence.length > 0 && (
        <EvidenceDisclosure evidence={gen.evidence} postHref={postHref} />
      )}
      {gen && gen.evidence.length === 0 && (
        <p className="text-muted-foreground text-[12px] italic">
          Evidencia no disponible: la respuesta no citó datos verificables del
          contexto.
        </p>
      )}
      {recs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-success-fg text-[11px] font-extrabold uppercase tracking-wider">
            Recomendaciones
          </p>
          <ul className="space-y-1.5">
            {recs.map((r, i) => (
              <li
                key={i}
                className="bg-card border-border rounded-xl border px-3 py-2 text-[13px]"
              >
                {r.text}
                {r.evidence.length > 0 && (
                  <EvidenceDisclosure
                    evidence={r.evidence}
                    postHref={postHref}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.limitations.length > 0 && (
        <div className="bg-muted/70 rounded-xl px-3 py-2">
          <SectionLabel>Limitaciones</SectionLabel>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-[12px]">
            {a.limitations.map((l) => (
              <li key={l}>· {l}</li>
            ))}
          </ul>
        </div>
      )}
      {gen && !gen.complete && (
        <p className="text-warning-fg text-xs font-bold">
          Respuesta incompleta: el proveedor la cortó antes de terminar. Tómala
          con cautela.
        </p>
      )}
      {gen && gen.followUps.length > 0 && (
        <div>
          <SectionLabel>Preguntas de seguimiento</SectionLabel>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {gen.followUps.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onFollowUp(s)}
                className="bg-card hover:border-ai-fg/40 border-border rounded-full border px-2.5 py-1 text-left text-[12px] font-bold disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Respuesta de Foxy: identifica el motor y muestra la respuesta generativa o la local. */
export function FoxyAnswer({
  turn,
  postHref,
  onFollowUp,
  disabled,
}: {
  turn: Turn;
  postHref: (id: string) => string;
  onFollowUp: (q: string) => void;
  disabled?: boolean;
}) {
  const genMeta = isGenMeta(turn.meta) ? turn.meta : null;
  const badge = genMeta ? <MetaBadge meta={genMeta} /> : null;
  if (turn.status === 'pending')
    return (
      <p
        className="text-muted-foreground flex items-center gap-2 text-sm"
        role="status"
      >
        <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> Foxy está
        analizando…
      </p>
    );
  if (turn.status === 'streaming')
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          <span
            className="text-ai-fg inline-flex items-center gap-1 text-[11px] font-extrabold"
            role="status"
          >
            <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" />{' '}
            Escribiendo…
          </span>
        </div>
        <FoxyGenAnswer
          draft={turn.draft}
          streaming
          postHref={postHref}
          onFollowUp={onFollowUp}
          disabled
        />
      </div>
    );
  if (
    (turn.status === 'error' || turn.status === 'cancelled') &&
    !turn.a &&
    !turn.gen
  )
    return (
      <div className="space-y-2">
        {turn.draft && (
          <div className="opacity-70">
            <FoxyGenAnswer
              draft={turn.draft}
              streaming={false}
              postHref={postHref}
              onFollowUp={onFollowUp}
              disabled
            />
          </div>
        )}
        <AiStateNotice
          tone={turn.status === 'cancelled' ? 'neutral' : 'critical'}
          title={
            turn.status === 'cancelled'
              ? 'Generación detenida'
              : 'No se pudo completar la respuesta'
          }
        >
          {turn.status === 'cancelled'
            ? 'Detuviste la respuesta. Lo recibido hasta ese momento queda incompleto y no se usa como evidencia.'
            : turn.error}
        </AiStateNotice>
      </div>
    );
  if (turn.gen && genMeta)
    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">{badge}</div>
        <FoxyGenAnswer
          gen={turn.gen}
          streaming={false}
          postHref={postHref}
          onFollowUp={onFollowUp}
          disabled={disabled}
        />
        {genMeta.syntheticInput && (
          <p className="text-warning-fg text-xs font-bold">
            Datos sintéticos de prueba: no describen una marca real.
          </p>
        )}
        <AdjustmentsNote meta={genMeta} />
      </div>
    );
  const a = turn.a!;
  const info = a.findings.filter((f) => f.kind !== 'recommendation');
  const recs = a.findings.filter((f) => f.kind === 'recommendation');
  const limits = [
    ...new Set(a.findings.map((f) => f.limitation).filter(Boolean)),
  ] as string[];
  return (
    <div className="space-y-2.5">
      {genMeta && genMeta.state === 'fallback' && (
        <div className="flex flex-wrap items-center gap-2">{badge}</div>
      )}
      {turn.error && genMeta?.state === 'fallback' && (
        <AiStateNotice tone="critical" title="Error del proveedor de IA">
          {turn.error}
        </AiStateNotice>
      )}
      {genMeta && genMeta.state === 'fallback' && !turn.error && (
        <FallbackNotice meta={genMeta} />
      )}
      {a.unanswerable ? (
        <p className="bg-card border-border rounded-xl border p-3 text-sm">
          {a.unanswerable}
        </p>
      ) : (
        a.headline &&
        a.findings.length > 1 && (
          <p className="text-[15px] font-extrabold leading-snug">
            {a.headline}
          </p>
        )
      )}
      {info.map((f, j) => (
        <FindingCard key={j} f={f} postHref={postHref} compact hideLimitation />
      ))}
      {recs.length > 0 && (
        <div className="space-y-2">
          <p className="text-success-fg text-[11px] font-extrabold uppercase tracking-wider">
            Recomendaciones
          </p>
          {recs.map((f, j) => (
            <FindingCard
              key={j}
              f={f}
              postHref={postHref}
              compact
              hideLimitation
            />
          ))}
        </div>
      )}
      {limits.length > 0 && (
        <div className="bg-muted/70 rounded-xl px-3 py-2">
          <p className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
            Limitaciones
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-[12px]">
            {limits.map((l) => (
              <li key={l}>· {l}</li>
            ))}
          </ul>
        </div>
      )}
      {turn.meta?.syntheticInput && (
        <p className="text-warning-fg text-xs font-bold">
          Datos sintéticos de prueba: no describen una marca real.
        </p>
      )}
      {a.suggestions.length > 0 && (
        <div>
          <p className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
            Preguntas de seguimiento
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {a.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onFollowUp(s)}
                className="bg-card hover:border-ai-fg/40 border-border rounded-full border px-2.5 py-1 text-left text-[12px] font-bold disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Caja de pregunta compartida (contextual, panel lateral y módulo general). */
export function AskBox({
  id,
  onAsk,
  pending,
  autoFocus,
  onCancel,
}: {
  id: string;
  onAsk: (q: string) => void;
  pending: boolean;
  autoFocus?: boolean;
  /** Si se indica, mientras hay una respuesta en curso el botón permite detenerla. */
  onCancel?: () => void;
}) {
  const [q, setQ] = useState('');
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (pending || q.trim().length < 3) return;
    onAsk(q);
    setQ('');
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor={id} className="sr-only">
        Pregunta para Foxy
      </label>
      <textarea
        id={id}
        rows={1}
        maxLength={500}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
        placeholder="Pregúntale lo que quieras a Foxy..."
        className="bg-card border-border focus-visible:ring-primary-text min-h-[44px] flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-sm"
      />
      {pending && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="border-border bg-card hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
          aria-label="Detener respuesta"
        >
          <Square aria-hidden className="h-4 w-4 fill-current" />
        </button>
      ) : (
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
      )}
    </form>
  );
}

/** Lista de turnos (pregunta del usuario + respuesta de Foxy). */
export function FoxyThread({
  turns,
  postHref,
  onAsk,
  pending,
}: {
  turns: Turn[];
  postHref: (id: string) => string;
  onAsk: (q: string) => void;
  pending: boolean;
}) {
  if (!turns.length) return null;
  return (
    <ol className="space-y-4" aria-live="polite">
      {turns.map((t, i) => (
        <li key={i} className="space-y-2">
          <p className="bg-brand text-brand-foreground ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm font-bold">
            {t.q}
          </p>
          <FoxyAnswer
            turn={t}
            postHref={postHref}
            onFollowUp={onAsk}
            disabled={pending}
          />
        </li>
      ))}
    </ol>
  );
}

/** Ask Foxy contextual: preguntas sugeridas + consulta libre; respuestas con evidencia. */
export function AskFoxyContextual({
  postId,
  period,
  platform,
  suggestions,
  scopeLabel,
  postHrefPattern,
  engine = {
    state: 'local',
    label: 'Motor local por reglas · sin IA generativa',
  },
}: {
  postId: string | null;
  period: string;
  platform?: string | null;
  suggestions: readonly string[];
  scopeLabel: string;
  /** Patrón del enlace a una publicación citada como evidencia («{id}» se sustituye). */
  postHrefPattern: string;
  /** Motor disponible según el servidor (cada respuesta declara además el que la produjo). */
  engine?: { state: EngineBadgeState; label: string };
}) {
  const postHref = (id: string) =>
    postHrefPattern.replace('{id}', encodeURIComponent(id));
  const { turns, ask, pending, cancel } = useFoxyConversation({
    postId,
    period,
    platform,
    scopeLabel,
  });
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
        <EngineBadge state={engine.state} label={engine.label} />
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
      <div className="mt-4">
        <FoxyThread
          turns={turns}
          postHref={postHref}
          onAsk={ask}
          pending={pending}
        />
      </div>
      <div className="mt-4">
        <AskBox
          id={`ask-${postId ?? 'brand'}`}
          onAsk={ask}
          pending={pending}
          onCancel={cancel}
        />
      </div>
    </section>
  );
}

/**
 * Pestañas de Foxy Intelligence (DS v0.4): solo se muestra la pestaña activa. Navegación por
 * teclado (flechas, Inicio, Fin) según el patrón ARIA de pestañas.
 */
export function IntelligenceTabs({
  tabs,
  label,
}: {
  label: string;
  tabs: Array<{
    id: string;
    label: string;
    badge?: string;
    content: ReactNode;
  }>;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (to: number) => {
    const t = tabs[(to + tabs.length) % tabs.length]!;
    setActive(t.id);
    refs.current[t.id]?.focus();
  };
  const idx = tabs.findIndex((t) => t.id === active);
  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1.5 overflow-x-auto pb-1 text-xs font-extrabold"
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1);
              else if (e.key === 'ArrowLeft') move(i - 1);
              else if (e.key === 'Home') move(0);
              else if (e.key === 'End') move(tabs.length - 1);
              else return;
              e.preventDefault();
            }}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors',
              t.id === active
                ? 'bg-brand text-brand-foreground'
                : 'bg-card/80 hover:bg-card text-foreground',
            )}
          >
            {t.label}
            {t.badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px]',
                  t.id === active ? 'bg-white/20' : 'bg-muted',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={i !== idx}
          tabIndex={0}
          className="mt-4 outline-none"
        >
          {i === idx ? t.content : null}
        </div>
      ))}
    </div>
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
