import {
  CircleCheck,
  Info,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Sparkline } from './charts';
import { FoxyMark } from './foxy';
import { Delta, IconBadge, Panel, StatusPill, type Tone } from './primitives';

/* Piezas de página: cabecera de módulo, KPI, cobertura y panel de Foxy. */

export type Module = 'home' | 'explorer';
const MODULE_VAR: Record<Module, string> = {
  home: '--mod-home',
  explorer: '--mod-explorer',
};

/** Fondo tonal del módulo (DS: superficies diferenciadas por módulo). */
export function ModuleSurface({
  module,
  children,
}: {
  module: Module;
  children: ReactNode;
}) {
  return (
    <div
      data-module={module}
      className="-mx-4 -mt-6 px-4 pb-8 pt-6 md:-mx-8 md:px-8"
      style={{
        // Banda tonal del módulo que se funde con el fondo: diferencia Home (lavanda)
        // de Explorer (azul) sin colorear las tarjetas.
        backgroundImage: `linear-gradient(to bottom, hsl(var(${MODULE_VAR[module]})) 0, hsl(var(${MODULE_VAR[module]}) / 0.75) 320px, hsl(var(--background)) 760px)`,
      }}
    >
      {children}
    </div>
  );
}

export function PageHeaderV2({
  icon: Icon,
  tone = 'ai',
  eyebrow,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  tone?: Tone;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge
          icon={Icon}
          tone={tone}
          size="lg"
          className="hidden sm:inline-flex"
        />
        <div className="min-w-0">
          <p className="text-primary-text text-xs font-extrabold uppercase tracking-[0.12em]">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 text-[26px] font-black leading-tight tracking-tight sm:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 max-w-2xl text-[15px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export function KpiCard({
  icon,
  tone,
  label,
  value,
  period,
  delta,
  href,
  spark,
  hint,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  period: string;
  delta?: {
    value: number | null;
    comparable: boolean;
    unit?: string;
    goodWhen?: 'up' | 'down' | 'neutral';
    reason?: 'no_base' | 'no_current';
  };
  href?: string;
  spark?: number[];
  hint?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <IconBadge icon={icon} tone={tone} size="sm" />
        <p className="line-clamp-2 text-[13px] font-extrabold leading-tight">
          {label}
        </p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[26px] font-black tabular-nums leading-none tracking-tight">
          {value}
        </p>
        {delta && <Delta {...delta} />}
      </div>
      <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-snug">
        {period}
      </p>
      {spark && <Sparkline values={spark} className="mt-2 h-6" />}
      {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
    </>
  );
  const cls =
    'rounded-card border-border/80 bg-card shadow-card block border p-3.5 transition-shadow duration-base';
  return href ? (
    <Link
      href={href}
      className={cn(cls, 'hover:shadow-lift hover:border-control/40')}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Requisito D: toda vista de datos declara su cobertura real. */
export function CoverageBannerV2({
  connected,
  missing,
}: {
  connected: string[];
  missing: string[];
}) {
  const partial = missing.length > 0 || connected.length === 0;
  return (
    <div
      className={cn(
        'rounded-card mb-4 flex gap-2.5 border px-3.5 py-2.5 text-[13px]',
        partial
          ? 'border-warning-border bg-warning-soft'
          : 'border-border bg-card',
      )}
    >
      {partial ? (
        <TriangleAlert
          aria-hidden
          className="text-warning-fg mt-px h-4 w-4 shrink-0"
        />
      ) : (
        <CircleCheck
          aria-hidden
          className="text-success-fg mt-px h-4 w-4 shrink-0"
        />
      )}
      <details className="group min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 [&::-webkit-details-marker]:hidden">
          <span className="font-extrabold">
            {partial ? 'Cobertura parcial' : 'Cobertura completa'}
          </span>
          <span className="text-muted-foreground">
            {connected.length} {connected.length === 1 ? 'fuente' : 'fuentes'}{' '}
            conectadas
            {missing.length > 0 ? ` · ${missing.length} sin escuchar` : ''} · no
            representa la conversación total del mercado
          </span>
          <span className="text-primary-text font-bold underline underline-offset-2">
            <span className="group-open:hidden">Ver fuentes</span>
            <span className="hidden group-open:inline">Ocultar fuentes</span>
          </span>
        </summary>
        <div className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
          <p>
            <b className="text-foreground">Conectadas:</b>{' '}
            {connected.length ? connected.join(', ') : 'ninguna fuente'}.
          </p>
          {missing.length > 0 && (
            <p>
              <b className="text-foreground">Sin escuchar:</b>{' '}
              {missing.join(', ')}.
            </p>
          )}
          <Link
            href="/cobertura"
            className="text-primary-text inline-block font-bold underline underline-offset-2"
          >
            Ver cobertura
          </Link>
        </div>
      </details>
    </div>
  );
}

export interface FoxyFindingView {
  id: string;
  tone: Tone;
  icon: LucideIcon;
  text: string;
  /** Base cuantitativa del hallazgo (p. ej. «9 de 20 conversaciones»). */
  basis: string;
  evidence: Array<{ label: string; href: string }>;
}

/**
 * Foxy IA como copiloto (DS §7): hallazgo, evidencia citada, base y limitaciones.
 * Indica su origen; no ejecuta acciones: solo propone y lleva a la evidencia.
 */
export function FoxyInsightPanel({
  title = 'Hallazgos de Foxy IA',
  subtitle,
  findings,
  limitation,
  origin = 'Generado por reglas sobre los datos del periodo · sin IA generativa',
  actions,
  wide,
  className,
}: {
  title?: string;
  subtitle?: string;
  findings: FoxyFindingView[];
  limitation?: string;
  origin?: string;
  actions?: Array<{ label: string; href: string; icon?: LucideIcon }>;
  /** Hallazgos en dos columnas desde sm (panel ancho). */
  wide?: boolean;
  className?: string;
}) {
  return (
    <Panel
      as="aside"
      aria-label={title}
      className={cn(
        'from-primary-pale/70 to-card bg-gradient-to-br',
        className,
      )}
    >
      <header className="mb-4 flex items-center gap-3">
        <FoxyMark variant="avatar" size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold">
            {title}
            <Sparkles aria-hidden className="text-primary-text h-4 w-4" />
          </h2>
          {subtitle && (
            <p className="text-muted-foreground text-[13px]">{subtitle}</p>
          )}
        </div>
      </header>
      {findings.length === 0 ? (
        <p className="text-muted-foreground bg-card/70 rounded-xl p-3 text-sm">
          Sin hallazgos: no hay datos suficientes en el periodo para sostener
          una conclusión. Prueba con un periodo más amplio.
        </p>
      ) : (
        <ul className={cn('grid gap-3', wide && 'sm:grid-cols-2')}>
          {findings.map((f) => (
            <li
              key={f.id}
              className="bg-card/80 border-border/70 rounded-xl border p-3"
            >
              <div className="flex gap-3">
                <IconBadge icon={f.icon} tone={f.tone} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{f.text}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {f.basis}
                  </p>
                  {f.evidence.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground font-semibold">
                        Evidencia:
                      </span>
                      {f.evidence.map((e) => (
                        <Link
                          key={e.href}
                          href={e.href}
                          className="text-primary-text font-bold underline underline-offset-2"
                        >
                          {e.label}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-wide">
            Acciones sugeridas
          </p>
          <ul className={cn('grid gap-1.5', wide && 'sm:grid-cols-2')}>
            {actions.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="bg-card/70 border-border/70 hover:border-control/50 hover:bg-card flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors"
                >
                  {a.icon && (
                    <a.icon aria-hidden className="text-primary-text h-4 w-4" />
                  )}
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-[11px]">
            Foxy sugiere; ninguna acción se ejecuta sin confirmación humana.
          </p>
        </div>
      )}
      <footer className="border-border/70 mt-4 space-y-1 border-t pt-3">
        <p className="flex items-center gap-1.5">
          <StatusPill tone="ai" icon={Info} className="whitespace-normal">
            {origin}
          </StatusPill>
        </p>
        {limitation && (
          <p className="text-muted-foreground text-xs">{limitation}</p>
        )}
      </footer>
    </Panel>
  );
}
