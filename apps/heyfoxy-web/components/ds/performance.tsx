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
  Scale,
  Smile,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ComparisonMetric, PostComparison } from '@/lib/intel/brand';
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

/**
 * Ayuda contextual accesible: visible al pasar el cursor o al enfocar. Se ancla al borde
 * derecho del icono (se abre hacia la izquierda), de modo que no se sale de la tarjeta ni de
 * la pantalla en la última columna; la tarjeta no recorta su contenido (HF-UX-15).
 */
export function InfoTip({
  text,
  label,
  align = 'end',
}: {
  text: string;
  label: string;
  /**
   * end: se abre hacia la izquierda (iconos a la derecha); start: hacia la derecha;
   * card: ocupa el ancho de la tarjeta contenedora (posicionada), nunca sale de ella.
   */
  align?: 'start' | 'end' | 'card';
}) {
  return (
    <span
      className={cn('group/tip inline-flex', align !== 'card' && 'relative')}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus-visible:text-foreground rounded-full"
        aria-label={`Qué es ${label}`}
        aria-describedby={undefined}
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          'bg-foreground text-background shadow-lift pointer-events-none absolute z-30 hidden rounded-lg px-3 py-2 text-xs font-semibold leading-snug group-focus-within/tip:block group-hover/tip:block',
          align === 'card'
            ? 'inset-x-3 top-14'
            : 'top-full mt-2 w-[min(15rem,80vw)]',
          align === 'end' && 'right-0',
          align === 'start' && 'left-0',
        )}
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
    <div className="rounded-card border-border/80 bg-card shadow-card relative border p-4">
      <span
        aria-hidden
        className={cn('rounded-t-card absolute inset-x-0 top-0 h-1', t.bar)}
      />
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
        <InfoTip text={reading.definition} label={reading.label} align="card" />
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
  description,
  stacked = false,
}: {
  data: InteractionBreakdownData;
  networkLabel: string;
  reactions?: Array<{ type: string; value: number }>;
  description?: string;
  /** Anillo sobre las barras siempre (contenedores estrechos, p. ej. tres columnas). */
  stacked?: boolean;
}) {
  const total = data.componentsTotal;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <ChartCard
      icon={MousePointerClick}
      tone="high"
      title="Distribución de interacciones"
      description={
        description ??
        `Componentes que entrega ${networkLabel}, última medición.`
      }
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
        <div
          className={cn(
            'flex flex-col items-center gap-5',
            !stacked && 'md:flex-row md:items-center',
          )}
        >
          {/* Anillo sin leyenda propia: la leyenda son las barras (sin duplicar). */}
          <div className="shrink-0">
            <Donut
              stacked
              legend={false}
              centerValue={total.toLocaleString('es-CO')}
              centerLabel="interacciones"
              segments={data.parts.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.value,
                color: p.color,
              }))}
            />
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-3.5">
            {data.parts.map((p) => {
              const Icon = IX_ICON[p.key] ?? MousePointerClick;
              return (
                <li
                  key={p.key}
                  title={`${p.label}: ${p.value.toLocaleString('es-CO')} (${pct(p.value)} % de ${total.toLocaleString('es-CO')})`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        IX_BAR[p.key],
                      )}
                    />
                    <Icon
                      aria-hidden
                      className="text-muted-foreground h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {p.label}
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      <b>{p.value.toLocaleString('es-CO')}</b>
                      <span className="text-muted-foreground inline-block w-14 text-right">
                        {pct(p.value)} %
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

const CMP_BAR: Record<ComparisonMetric['key'], string> = {
  engagement: 'bg-metric-engagement',
  reach: 'bg-metric-reach',
  interactions: 'bg-metric-interactions',
};

const fmtCmp = (v: number, unit: string) =>
  unit === '%'
    ? `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`
    : Math.round(v).toLocaleString('es-CO');

/**
 * Rendimiento comparable (DS v0.4): la publicación frente a la mediana de publicaciones
 * equivalentes de la MISMA red y tipo de formato, más la mediana de engagement por formato en
 * esa red. Declara muestra y periodo; describe, no demuestra causalidad.
 */
export function PerformanceComparison({
  data,
  periodLabel,
}: {
  data: PostComparison;
  periodLabel: string;
}) {
  const fmtMax = Math.max(
    0,
    ...data.formats.map((f) => f.engagementMedian ?? 0),
  );
  return (
    <ChartCard
      icon={Scale}
      tone="info"
      title="Rendimiento comparable"
      description={`Frente a ${data.sample} ${data.sample === 1 ? 'publicación' : 'publicaciones'} de ${data.network} con formato ${data.group} · ${periodLabel.toLowerCase()}.`}
      table={{
        caption: 'Rendimiento frente a publicaciones equivalentes',
        columns: ['Métrica', 'Esta publicación', 'Mediana de equivalentes'],
        rows: data.metrics.map((m) => [
          m.label,
          m.value != null ? fmtCmp(m.value, m.unit) : '—',
          m.median != null ? fmtCmp(m.median, m.unit) : 'Base insuficiente',
        ]),
      }}
    >
      {!data.enough && (
        <p className="bg-muted text-muted-foreground mb-3 rounded-xl px-3 py-2 text-xs font-semibold">
          Base insuficiente para calcular medianas: hay {data.sample}{' '}
          {data.sample === 1 ? 'equivalente' : 'equivalentes'} y se necesitan al
          menos {data.minSample}. Amplía el periodo para comparar.
        </p>
      )}
      <ul className="space-y-4">
        {data.metrics.map((m) => {
          const scale = m.max ?? 0;
          const w = (v: number | null) =>
            v != null && scale > 0 ? Math.max(2, (v / scale) * 100) : 0;
          return (
            <li key={m.key}>
              <p className="text-sm font-extrabold">{m.label}</p>
              <div className="mt-1.5 space-y-1.5 text-xs">
                {(
                  [
                    ['Esta publicación', m.value, CMP_BAR[m.key]],
                    [
                      'Mediana de equivalentes',
                      m.median,
                      'bg-muted-foreground/45',
                    ],
                  ] as const
                ).map(([label, v, bar]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <span className="text-muted-foreground truncate font-semibold">
                      {label}
                    </span>
                    <span
                      className="bg-muted h-2.5 overflow-hidden rounded-full"
                      aria-hidden
                    >
                      <span
                        className={cn('block h-full rounded-full', bar)}
                        style={{ width: `${w(v)}%` }}
                      />
                    </span>
                    <b className="w-16 whitespace-nowrap text-right tabular-nums">
                      {v != null ? fmtCmp(v, m.unit) : '—'}
                    </b>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {data.formats.length > 0 && (
        <div className="border-border mt-4 border-t pt-3">
          <p className="text-sm font-extrabold">
            Engagement por formato en {data.network}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {data.formats.map((f) => (
              <li
                key={f.format}
                className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-2"
              >
                <span className="truncate font-semibold">
                  {f.format}{' '}
                  <span className="text-muted-foreground">(n = {f.n})</span>
                </span>
                <span
                  className="bg-muted h-2.5 overflow-hidden rounded-full"
                  aria-hidden
                >
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      f.n >= data.minSample
                        ? 'bg-metric-engagement'
                        : 'bg-metric-engagement/40',
                    )}
                    style={{
                      width: `${fmtMax > 0 && f.engagementMedian != null ? Math.max(2, (f.engagementMedian / fmtMax) * 100) : 0}%`,
                    }}
                  />
                </span>
                <b className="w-16 whitespace-nowrap text-right tabular-nums">
                  {f.engagementMedian != null
                    ? fmtCmp(f.engagementMedian, '%')
                    : '—'}
                </b>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-[11.5px]">
            Mediana por formato; con n &lt; {data.minSample} la barra se atenúa
            (base pequeña).
          </p>
        </div>
      )}
      <p className="text-muted-foreground mt-3 text-[11.5px]">
        Engagement de {data.network} = {data.engagementBasis}. Solo se compara
        dentro de la misma red. Descriptivo: no controla horario, pauta ni tema
        y no demuestra causalidad.
      </p>
    </ChartCard>
  );
}
