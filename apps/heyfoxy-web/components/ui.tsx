import { cn } from '@/lib/cn';
import { COVERAGE_LABEL, SENTIMENT_LABEL, SEVERITY_LABEL } from '@/lib/format';
import type { CoverageStatus, Sentiment, Severity } from '@/lib/types';
import { AlertTriangle, FlaskConical, Info } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Card({
  className,
  children,
  scrollLabel,
}: {
  className?: string;
  children: ReactNode;
  /** Si el contenido tiene scroll horizontal: región enfocable con teclado (WCAG 2.1.1). */
  scrollLabel?: string;
}) {
  return (
    <section
      className={cn('bg-card rounded-lg border p-4', className)}
      {...(scrollLabel
        ? { role: 'region', 'aria-label': scrollLabel, tabIndex: 0 }
        : {})}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  layer,
  description,
  actions,
}: {
  title: string;
  layer?: 'operational' | 'reputational' | 'platform';
  description?: string;
  actions?: ReactNode;
}) {
  const tag =
    layer === 'operational'
      ? 'Escucha operativa'
      : layer === 'reputational'
        ? 'Inteligencia reputacional'
        : layer === 'platform'
          ? 'Plataforma'
          : null;
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {tag && (
          <p className="text-primary-text text-xs font-medium uppercase tracking-wider">
            {tag}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {description}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}

const tone = {
  neutral: 'bg-muted text-muted-foreground',
  green: 'bg-success-bg text-success-fg',
  red: 'bg-critical-bg text-critical-fg',
  amber: 'bg-warning-bg text-warning-fg',
  orange: 'bg-high-bg text-high-fg',
  blue: 'bg-info-bg text-info-fg',
  violet: 'bg-ai-bg text-ai-fg',
} as const;
export type Tone = keyof typeof tone;

export function Badge({
  children,
  t = 'neutral',
  className,
}: {
  children: ReactNode;
  t?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tone[t],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ s }: { s: Severity }) {
  const t: Tone =
    s === 'critical'
      ? 'red'
      : s === 'high'
        ? 'orange'
        : s === 'attention'
          ? 'amber'
          : 'neutral';
  return <Badge t={t}>{SEVERITY_LABEL[s]}</Badge>;
}
export function SentimentBadge({ s }: { s: Sentiment }) {
  const t: Tone =
    s === 'positive'
      ? 'green'
      : s === 'negative'
        ? 'red'
        : s === 'mixed'
          ? 'violet'
          : 'neutral';
  return <Badge t={t}>{SENTIMENT_LABEL[s]}</Badge>;
}
export function CoverageBadge({ s }: { s: CoverageStatus }) {
  const t: Tone =
    s === 'complete'
      ? 'green'
      : s === 'partial'
        ? 'amber'
        : s === 'not_permitted'
          ? 'red'
          : 'neutral';
  return <Badge t={t}>{COVERAGE_LABEL[s]}</Badge>;
}
export function SyntheticTag() {
  return (
    <Badge t="amber" className="uppercase tracking-wide">
      <FlaskConical aria-hidden className="h-3 w-3" /> Ficticio
    </Badge>
  );
}

export function DemoBanner() {
  return (
    <div
      role="status"
      className="bg-demo text-demo-foreground flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wider"
    >
      <FlaskConical aria-hidden className="h-4 w-4" />
      Datos de demostración: organizaciones, personas y conversaciones ficticias
    </div>
  );
}

/** Requisito D: toda vista de datos declara su cobertura real. */
export function CoverageNotice({
  connected,
  missing,
}: {
  connected: string[];
  missing: string[];
}) {
  return (
    <div className="border-warning-border bg-warning-soft mb-5 flex gap-3 rounded-lg border p-3 text-sm">
      <Info aria-hidden className="text-warning-fg mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-muted-foreground">
        <span className="text-foreground font-medium">Cobertura parcial.</span>{' '}
        Estos datos provienen solo de:{' '}
        {connected.length ? connected.join(', ') : 'ninguna fuente'}.{' '}
        {missing.length > 0 && <>No se escucha: {missing.join(', ')}. </>}
        No representan la conversación total del mercado.{' '}
        <Link
          href="/cobertura"
          className="text-primary-text underline underline-offset-2"
        >
          Ver cobertura
        </Link>
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="text-muted-foreground mt-1 text-sm">{children}</div>
      )}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-critical-border bg-critical-soft text-critical-strong flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <AlertTriangle aria-hidden className="h-4 w-4" /> {children}
    </p>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </Card>
  );
}

export const buttonCls = {
  primary:
    'inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-40',
  ghost:
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40',
  danger:
    'inline-flex items-center gap-1.5 rounded-md border border-critical-border-strong px-3 py-1.5 text-sm text-critical-strong hover:bg-critical-soft',
};
