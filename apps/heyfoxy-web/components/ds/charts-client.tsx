'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* Gráficos interactivos: puntos y leyendas enfocables con teclado, tooltip al
 * pasar o enfocar, y enlace a la evidencia. La tabla accesible la añade ChartCard. */

export interface TrendPoint {
  /** Etiqueta corta del eje (p. ej. «14 nov»). */
  label: string;
  value: number;
  /** Detalle del tooltip (p. ej. «3 negativas · 1 positiva»). */
  detail?: string;
  href?: string;
}

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = Math.ceil(v / p);
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/**
 * Área con línea. Se destaca un punto (por defecto el último; p. ej. el pico) y puede
 * superponerse una serie secundaria (p. ej. negativas). Coordenadas en %, nítido a cualquier ancho.
 */
export function AreaTrend({
  points,
  unit,
  highlight,
  highlightIndex,
  secondary,
  primaryLabel,
  height = 220,
}: {
  points: TrendPoint[];
  unit: string;
  /** Texto del globo del punto destacado (p. ej. «Pico del periodo»). */
  highlight?: string;
  /** Índice del punto destacado; por defecto, el último. */
  highlightIndex?: number;
  /** Serie superpuesta (misma longitud que `points`), sin área. */
  secondary?: { label: string; values: number[]; color: string };
  /** Nombre de la serie principal en la leyenda (solo si hay secundaria). */
  primaryLabel?: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const line2 = secondary
    ? secondary.values.map((v, i) => `${x(i)},${y(v ?? 0)}`).join(' ')
    : null;
  const area = `0,100 ${line} 100,100`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const last = n - 1;
  const hi =
    highlightIndex !== undefined && highlightIndex >= 0 && highlightIndex < n
      ? highlightIndex
      : last;
  const shown = active ?? (highlight ? hi : null);

  return (
    <div className="flex gap-2">
      <div
        className="text-muted-foreground relative w-9 shrink-0 text-right text-[11px] tabular-nums"
        style={{ height }}
        aria-hidden
      >
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${y(t)}%` }}
          >
            {t.toLocaleString('es-CO')}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className="border-border absolute inset-x-0 border-t border-dashed"
              style={{ top: `${y(t)}%` }}
            />
          ))}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--brand))"
                  stopOpacity="0.32"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--brand))"
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#g${gid})`} />
            <polyline
              points={line}
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {line2 && secondary && (
              <polyline
                points={line2}
                fill="none"
                stroke={`hsl(var(--${secondary.color}))`}
                strokeWidth="2"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
          {points.map((p, i) => {
            const isActive = shown === i;
            const text = `${p.label}: ${p.value.toLocaleString('es-CO')} ${unit}${p.detail ? ` · ${p.detail}` : ''}`;
            const dot = (
              <span
                className={cn(
                  'border-brand bg-card block rounded-full transition-transform',
                  isActive ? 'h-4 w-4 border-[3px]' : 'h-2 w-2 border-2',
                )}
              />
            );
            const common = {
              'aria-label': text,
              onMouseEnter: () => setActive(i),
              onMouseLeave: () => setActive(null),
              onFocus: () => setActive(i),
              onBlur: () => setActive(null),
              className:
                'absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
              style: { left: `${x(i)}%`, top: `${y(p.value)}%` },
            };
            return p.href ? (
              <Link key={p.label} href={p.href} {...common}>
                {dot}
              </Link>
            ) : (
              <button key={p.label} type="button" {...common}>
                {dot}
              </button>
            );
          })}
          {shown !== null && points[shown] && (
            <div
              aria-hidden
              className={cn(
                'bg-brand text-brand-foreground shadow-lift pointer-events-none absolute z-10 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-center text-xs font-bold',
                x(shown) > 70
                  ? '-translate-x-full'
                  : x(shown) < 30
                    ? ''
                    : '-translate-x-1/2',
              )}
              style={{
                left: `calc(${x(shown)}% + ${x(shown) > 70 ? 12 : x(shown) < 30 ? -12 : 0}px)`,
                top: `${y(points[shown]!.value)}%`,
              }}
            >
              <span className="block text-sm font-extrabold tabular-nums">
                {points[shown]!.value.toLocaleString('es-CO')}
              </span>
              {active === null && highlight
                ? highlight
                : (points[shown]!.detail ?? points[shown]!.label)}
            </div>
          )}
        </div>
        <div
          className="text-muted-foreground relative mt-2 h-4 text-[11px]"
          aria-hidden
        >
          {points.map((p, i) =>
            i % labelEvery === 0 || i === last ? (
              <span
                key={p.label}
                className={cn(
                  'absolute whitespace-nowrap',
                  i === 0
                    ? ''
                    : i === last
                      ? '-translate-x-full'
                      : '-translate-x-1/2',
                )}
                style={{ left: `${x(i)}%` }}
              >
                {p.label}
              </span>
            ) : null,
          )}
        </div>
        {secondary && (
          <p
            className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold"
            aria-hidden
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-brand h-0.5 w-4 rounded" />
              {primaryLabel ?? 'Total'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0 w-4 border-t-2 border-dashed"
                style={{ borderColor: `hsl(var(--${secondary.color}))` }}
              />
              {secondary.label}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** Variable CSS del color (p. ej. 'chart-pos'). */
  color: string;
  icon?: ReactNode;
  href?: string;
}

/** Anillo con leyenda interactiva: enfocar o pasar sobre una fila resalta su segmento. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  stacked = false,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  /** Anillo sobre la leyenda siempre (columnas estrechas). */
  stacked?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP =
    total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 1.2 : 0;
  let acc = 0;
  const arcs = segments.map((s) => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const arc = { s, len: Math.max(0, len - GAP), off: acc };
    acc += len;
    return arc;
  });
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-5',
        !stacked && 'sm:flex-row sm:items-center',
      )}
    >
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
          />
          {arcs.map(({ s, len, off }) =>
            len > 0 ? (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={`hsl(var(--${s.color}))`}
                strokeWidth={active === s.key ? 15 : 12}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-off}
                opacity={active && active !== s.key ? 0.35 : 1}
                className="duration-base transition-all"
              />
            ) : null,
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black tabular-nums">
            {centerValue}
          </span>
          <span className="text-muted-foreground text-xs font-semibold">
            {centerLabel}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {segments.map((s) => {
          const inner = (
            <>
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: `hsl(var(--${s.color}))` }}
              />
              {s.icon}
              <span className="flex-1 text-sm font-semibold">{s.label}</span>
              <span className="text-sm font-extrabold tabular-nums">
                {pct(s.value)}%
              </span>
              <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                ({s.value.toLocaleString('es-CO')})
              </span>
            </>
          );
          const handlers = {
            onMouseEnter: () => setActive(s.key),
            onMouseLeave: () => setActive(null),
            onFocus: () => setActive(s.key),
            onBlur: () => setActive(null),
          };
          const cls =
            'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted';
          return (
            <li key={s.key}>
              {s.href ? (
                <Link
                  href={s.href}
                  className={cls}
                  title="Ver conversaciones"
                  {...handlers}
                >
                  {inner}
                </Link>
              ) : (
                <div className={cls} {...handlers}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
