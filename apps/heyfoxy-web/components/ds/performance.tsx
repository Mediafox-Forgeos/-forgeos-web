import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  Eye,
  Heart,
  Info,
  MessageCircle,
  Minus,
  MousePointerClick,
  Percent,
  Repeat2,
  Smile,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  METRIC_STATE_LABEL,
  type InteractionBreakdownData,
  type MetricReading,
  type MetricState,
} from '@/lib/intel/metrics';
import { ChartCard } from './charts';
import { Donut } from './charts-client';

/*
 * Rendimiento (DS V2 · addendum §4–§5). Componentes de presentación reutilizables en Social
 * Explorer, Intelligence Home, Campaign Intelligence, Reports… Nunca inventan valores: cada
 * métrica muestra su estado (cero real, no disponible, no aplica, pendiente, privacidad).
 */

export type MetricTone =
  'reach' | 'engagement' | 'impressions' | 'interactions';

const TONE: Record<
  MetricTone,
  { bar: string; soft: string; text: string; icon: LucideIcon }
> = {
  reach: {
    bar: 'bg-metric-reach',
    soft: 'bg-metric-reach/10',
    text: 'text-metric-reach',
    icon: Users,
  },
  engagement: {
    bar: 'bg-metric-engagement',
    soft: 'bg-metric-engagement/10',
    text: 'text-metric-engagement',
    icon: Percent,
  },
  impressions: {
    bar: 'bg-metric-impressions',
    soft: 'bg-metric-impressions/10',
    text: 'text-metric-impressions',
    icon: Eye,
  },
  interactions: {
    bar: 'bg-metric-interactions',
    soft: 'bg-metric-interactions/10',
    text: 'text-metric-interactions',
    icon: MousePointerClick,
  },
};

const STATE_TONE: Record<MetricState, string> = {
  value: 'bg-success-bg text-success-fg',
  zero: 'bg-muted text-foreground',
  unavailable: 'bg-muted text-muted-foreground',
  not_applicable: 'bg-muted text-muted-foreground',
  pending: 'bg-info-bg text-info-fg',
  privacy: 'bg-ai-bg text-ai-fg',
};

/** Estado de disponibilidad de una métrica (nunca un 0 inventado). */
export function MetricAvailabilityState({
  state,
  className,
}: {
  state: MetricState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
        STATE_TONE[state],
        className,
      )}
    >
      {METRIC_STATE_LABEL[state]}
    </span>
  );
}

/** Ayuda contextual accesible: visible al pasar el cursor o al enfocar. */
export function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus-visible:text-foreground rounded-full"
        aria-label={`Qué es ${label}`}
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="bg-foreground text-background shadow-lift pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-60 -translate-x-1/2 rounded-lg px-3 py-2 text-xs font-semibold leading-snug group-focus-within/tip:block group-hover/tip:block"
      >
        {text}
      </span>
    </span>
  );
}

export function PerformanceMetricCard({
  reading,
  tone,
  comparison,
}: {
  reading: MetricReading;
  tone: MetricTone;
  /** Comparación con base suficiente (p. ej. «Mediana de 6 equivalentes: 4,4 %»). */
  comparison?: string | null;
}) {
  const t = TONE[tone];
  const Icon = t.icon;
  const has = reading.value != null;
  const d = reading.delta;
  return (
    <div className="rounded-card border-border/80 bg-card shadow-card relative overflow-hidden border p-4">
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', t.bar)} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              t.soft,
              t.text,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-[13px] font-extrabold leading-tight">
            {reading.label}
          </span>
        </span>
        <InfoTip text={reading.definition} label={reading.label} />
      </div>
      <p
        className={cn(
          'mt-3 tabular-nums tracking-tight',
          has
            ? 'text-[28px] font-extrabold leading-none'
            : 'text-muted-foreground text-sm font-bold',
        )}
      >
        {has ? (
          reading.display
        ) : (
          <MetricAvailabilityState state={reading.state} />
        )}
      </p>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {d != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-bold',
              d > 0
                ? 'text-success-fg'
                : d < 0
                  ? 'text-critical-fg'
                  : 'text-muted-foreground',
            )}
          >
            {d > 0 ? (
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
            ) : d < 0 ? (
              <ArrowDownRight aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <Minus aria-hidden className="h-3.5 w-3.5" />
            )}
            {d === 0
              ? 'Sin variación'
              : `${d > 0 ? '+' : ''}${d.toLocaleString('es-CO', { maximumFractionDigits: 2 })} vs. medición anterior`}
          </span>
        )}
        <span>{reading.source}</span>
      </div>
      {comparison && <p className="mt-1 text-xs font-semibold">{comparison}</p>}
    </div>
  );
}

const IX_ICON: Record<string, LucideIcon> = {
  likes: Heart,
  comments: MessageCircle,
  shares: Repeat2,
  saves: Bookmark,
  reactions: Smile,
};
const IX_BAR: Record<string, string> = {
  likes: 'bg-ix-likes',
  comments: 'bg-ix-comments',
  shares: 'bg-ix-shares',
  saves: 'bg-ix-saves',
  reactions: 'bg-ix-reactions',
};

/**
 * Distribución de interacciones: anillo + barras + tabla accesible. Solo componentes que la
 * red entrega por separado; si el total de la red difiere, se explica (sin sumar métricas
 * incompatibles).
 */
export function InteractionBreakdown({
  data,
  networkLabel,
  reactions = [],
}: {
  data: InteractionBreakdownData;
  networkLabel: string;
  reactions?: Array<{ type: string; value: number }>;
}) {
  const total = data.componentsTotal;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <ChartCard
      icon={MousePointerClick}
      tone="high"
      title="Distribución de interacciones"
      description={`Componentes que entrega ${networkLabel}, última medición.`}
      table={{
        caption: 'Distribución de interacciones',
        columns: ['Tipo', 'Cantidad', '%'],
        rows: data.parts.map((p) => [p.label, p.value, `${pct(p.value)} %`]),
      }}
    >
      {data.parts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          La fuente no entregó interacciones para esta publicación.
        </p>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <Donut
            stacked
            centerValue={total.toLocaleString('es-CO')}
            centerLabel="interacciones"
            segments={data.parts.map((p) => ({
              key: p.key,
              label: p.label,
              value: p.value,
              color: p.color,
            }))}
          />
          <ul className="space-y-3">
            {data.parts.map((p) => {
              const Icon = IX_ICON[p.key] ?? MousePointerClick;
              return (
                <li key={p.key}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-bold">
                      <Icon
                        aria-hidden
                        className="text-muted-foreground h-4 w-4"
                      />
                      {p.label}
                    </span>
                    <span className="tabular-nums">
                      <b>{p.value.toLocaleString('es-CO')}</b>{' '}
                      <span className="text-muted-foreground">
                        · {pct(p.value)} %
                      </span>
                    </span>
                  </div>
                  <div
                    className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full"
                    aria-hidden
                  >
                    <div
                      className={cn('h-full rounded-full', IX_BAR[p.key])}
                      style={{ width: `${pct(p.value)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="border-border mt-4 space-y-1 border-t pt-3 text-xs">
        <p>
          <b>Interacciones según Hey Foxy:</b> {total.toLocaleString('es-CO')}{' '}
          (suma de los componentes de arriba).
          {data.networkTotal != null && (
            <>
              {' '}
              <b>Según {networkLabel}:</b>{' '}
              {data.networkTotal.toLocaleString('es-CO')}.
            </>
          )}
        </p>
        {data.difference && (
          <p className="text-muted-foreground">{data.difference}</p>
        )}
        {data.unavailable.length > 0 && (
          <p className="text-muted-foreground">
            No entregados por la red: {data.unavailable.join(', ')}.
          </p>
        )}
        {reactions.length > 0 && (
          <p className="text-muted-foreground">
            Reacciones por tipo:{' '}
            {reactions
              .map((r) => `${r.type} ${r.value.toLocaleString('es-CO')}`)
              .join(' · ')}
            .
          </p>
        )}
        <p className="text-muted-foreground">
          «Comentarios en la red» es lo que reporta {networkLabel}; no son
          comentarios importados ni clasificados por Hey Foxy.
        </p>
      </div>
    </ChartCard>
  );
}
