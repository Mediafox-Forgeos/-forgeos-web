import {
  ArrowDownRight,
  ArrowUpRight,
  FlaskConical,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* Primitivas del Design System V2. Presentación pura: sin acceso a datos. */

export type Tone =
  'ai' | 'info' | 'success' | 'warning' | 'critical' | 'high' | 'neutral';

const TONE: Record<Tone, string> = {
  ai: 'bg-ai-bg text-ai-fg',
  info: 'bg-info-bg text-info-fg',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  critical: 'bg-critical-bg text-critical-fg',
  high: 'bg-high-bg text-high-fg',
  neutral: 'bg-muted text-muted-foreground',
};
export const toneCls = (t: Tone) => TONE[t];

export function Panel({
  className,
  children,
  as: As = 'section',
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: 'section' | 'div' | 'article' | 'aside';
  'aria-labelledby'?: string;
  'aria-label'?: string;
  id?: string;
}) {
  return (
    <As
      className={cn(
        'rounded-card border-border/80 bg-card shadow-card border p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function PanelHeader({
  icon: Icon,
  tone = 'ai',
  title,
  titleId,
  description,
  action,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <IconBadge icon={Icon} tone={tone} size="sm" />}
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-extrabold leading-tight tracking-tight"
          >
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function IconBadge({
  icon: Icon,
  tone = 'ai',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const ico = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        box,
        TONE[tone],
        className,
      )}
    >
      <Icon width={ico} height={ico} strokeWidth={1.9} />
    </span>
  );
}

export function StatusPill({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden width={13} height={13} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

/** Marca obligatoria de datos sintéticos (requisito de veracidad). */
export function SyntheticBadge({ className }: { className?: string }) {
  return (
    <StatusPill tone="warning" icon={FlaskConical} className={className}>
      Ficticio
    </StatusPill>
  );
}

const AVATAR_TONES: Tone[] = ['ai', 'info', 'success', 'high', 'warning'];
export function initials(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/^@/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Avatar de iniciales: nunca se inventa una foto de perfil. */
export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const key = [...(name ?? '')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-extrabold',
        TONE[AVATAR_TONES[key % AVATAR_TONES.length]!],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-card transition-colors duration-fast hover:bg-brand/90 disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-control border border-brand/50 bg-card px-4 py-2 text-sm font-bold text-primary-text transition-colors duration-fast hover:bg-primary-pale disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-control border border-critical-border bg-card px-4 py-2 text-sm font-bold text-critical-fg hover:bg-critical-bg',
};

export function ChipLink({
  href,
  active,
  children,
  icon,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'duration-fast inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors',
        active
          ? 'border-brand bg-brand text-brand-foreground'
          : 'border-border bg-card text-foreground hover:border-control hover:bg-muted',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/**
 * Variación respecto del periodo anterior. Regla del DS: sin base comparable
 * (periodo anterior en cero o sin datos) no se muestra ningún porcentaje.
 */
export function Delta({
  value,
  unit = '%',
  comparable,
  goodWhen = 'up',
  reason,
  className,
}: {
  value: number | null;
  unit?: string;
  comparable: boolean;
  goodWhen?: 'up' | 'down' | 'neutral';
  /** 'no_current': el periodo actual no tiene datos; si no, falta base anterior. */
  reason?: 'no_base' | 'no_current';
  className?: string;
}) {
  if (!comparable || value === null)
    return (
      <span
        className={cn(
          'text-muted-foreground inline-flex items-center gap-1 text-xs font-semibold',
          className,
        )}
      >
        <Minus aria-hidden width={12} height={12} />{' '}
        {reason === 'no_current'
          ? 'Sin datos en el periodo'
          : 'Sin base comparable'}
      </span>
    );
  const up = value > 0;
  const flat = value === 0;
  const good =
    flat || goodWhen === 'neutral' ? null : up === (goodWhen === 'up');
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tone: Tone = good === null ? 'neutral' : good ? 'success' : 'critical';
  return (
    <StatusPill tone={tone} icon={Icon} className={className}>
      <span className="sr-only">
        {flat ? 'Sin cambio' : up ? 'Sube' : 'Baja'}{' '}
      </span>
      {up ? '+' : ''}
      {value.toLocaleString('es-CO')}
      {unit}
    </StatusPill>
  );
}

/** Contenedor con scroll horizontal accesible por teclado (WCAG 2.1.1; axe scrollable-region-focusable). */
export function ScrollRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn('overflow-x-auto', className)}
    >
      {children}
    </div>
  );
}
