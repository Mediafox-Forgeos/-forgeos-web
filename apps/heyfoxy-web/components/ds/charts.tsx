import { Table2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { NetworkIcon } from './network-icons';
import { Panel, PanelHeader, type Tone } from './primitives';
import type { Platform } from '@/lib/types';

/* Gráficos de servidor (sin JS de cliente). Los interactivos están en charts-client.tsx. */

export interface DataTableSpec {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

/** Tabla alternativa accesible, obligatoria en todo gráfico (DS §Interacciones). */
export function ChartDataTable({ table }: { table: DataTableSpec }) {
  return (
    <details className="group mt-4">
      <summary className="text-primary-text inline-flex cursor-pointer select-none items-center gap-1.5 rounded text-xs font-bold">
        <Table2 aria-hidden width={14} height={14} />
        <span className="group-open:hidden">Ver datos en tabla</span>
        <span className="hidden group-open:inline">Ocultar tabla</span>
      </summary>
      <div
        role="region"
        aria-label={table.caption}
        tabIndex={0}
        className="mt-2 overflow-x-auto"
      >
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">{table.caption}</caption>
          <thead className="text-muted-foreground">
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col" className="py-1 pr-3 font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} className="py-1 pr-3">
                    {typeof v === 'number' ? v.toLocaleString('es-CO') : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ChartCard({
  icon,
  tone,
  title,
  description,
  action,
  table,
  children,
  className,
  footer,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  table: DataTableSpec;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const id = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <Panel className={cn('flex flex-col', className)} aria-labelledby={id}>
      <PanelHeader
        icon={icon}
        tone={tone}
        title={title}
        titleId={id}
        description={description}
        action={action}
      />
      <div className="flex-1">{children}</div>
      {footer}
      <ChartDataTable table={table} />
    </Panel>
  );
}

const pct = (v: number, total: number) =>
  total > 0 ? Math.round((v / total) * 100) : 0;

/** Barras horizontales con porcentaje y volumen; cada fila lleva a su evidencia. */
export function BarList({
  rows,
  total,
  unit = 'conversaciones',
}: {
  rows: Array<{
    label: string;
    value: number;
    href?: string;
    icon?: ReactNode;
  }>;
  total?: number;
  unit?: string;
}) {
  const sum = total ?? rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const p = pct(r.value, sum);
        const body = (
          <>
            <span className="flex items-center gap-2">
              {r.icon}
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                {r.label}
              </span>
              <span className="text-sm font-extrabold tabular-nums">
                {p}%
                <span className="text-muted-foreground ml-1 text-xs font-semibold">
                  ({r.value.toLocaleString('es-CO')})
                </span>
                <span className="sr-only"> {unit}</span>
              </span>
            </span>
            <span
              className="bg-muted relative mt-1.5 block h-2 overflow-hidden rounded-full"
              aria-hidden
            >
              <span
                className="from-brand to-accent-2 absolute inset-y-0 left-0 rounded-full bg-gradient-to-r"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
          </>
        );
        const cls = 'block';
        return (
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                title={`${r.value} ${unit} · ver evidencia`}
                className={cn(
                  cls,
                  'hover:bg-muted -mx-2 rounded-lg px-2 py-1 transition-colors',
                )}
              >
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Reparto por red social con su icono oficial; cada red lleva a su evidencia. */
export function ChannelShare({
  rows,
}: {
  rows: Array<{
    platform: Platform;
    label: string;
    value: number;
    href: string;
  }>;
}) {
  const sum = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {rows.map((r) => (
        <li key={r.platform}>
          <Link
            href={r.href}
            className="border-border hover:border-control hover:bg-muted flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors"
          >
            <NetworkIcon platform={r.platform} size={26} />
            <span className="text-base font-extrabold tabular-nums">
              {pct(r.value, sum)}%
            </span>
            <span className="text-muted-foreground text-[11px] font-semibold">
              {r.label}
            </span>
            <span className="sr-only">{r.value} conversaciones</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Mini serie decorativa para KPI (la cifra y su tabla van aparte). */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = 100 / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${30 - (v / max) * 26}`);
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('h-8 w-full', className)}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="hsl(var(--brand))"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
