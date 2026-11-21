import {
  CircleAlert,
  Hourglass,
  Inbox,
  Lock,
  PlugZap,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconBadge, type Tone } from './primitives';

/** Estados explícitos y recuperables (DS §12). Nunca se rellena un hueco con datos inventados. */
function StateBlock({
  icon,
  tone,
  title,
  children,
  role,
  className,
  compact,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children?: ReactNode;
  role?: 'status' | 'alert';
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-card border-border flex flex-col items-center justify-center border border-dashed text-center',
        compact ? 'gap-2 p-4' : 'gap-3 p-8',
        className,
      )}
    >
      <IconBadge icon={icon} tone={tone} size={compact ? 'sm' : 'md'} />
      <div>
        <p className="font-extrabold">{title}</p>
        {children && (
          <div className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

type P = {
  title?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
};

export const EmptyStateV2 = ({
  title = 'Sin datos para estos filtros',
  ...p
}: P) => <StateBlock icon={Inbox} tone="neutral" title={title} {...p} />;
export const LoadingState = ({ title = 'Cargando…', ...p }: P) => (
  <StateBlock icon={Hourglass} tone="info" title={title} role="status" {...p} />
);
export const ErrorState = ({ title = 'No se pudo cargar', ...p }: P) => (
  <StateBlock
    icon={CircleAlert}
    tone="critical"
    title={title}
    role="alert"
    {...p}
  />
);
export const PermissionState = ({
  title = 'Tu rol no tiene acceso a esta información',
  ...p
}: P) => <StateBlock icon={Lock} tone="neutral" title={title} {...p} />;
/** La capacidad existe pero hoy no hay fuente que la alimente. */
export const NotAvailableState = ({
  title = 'Sin datos disponibles',
  ...p
}: P) => <StateBlock icon={PlugZap} tone="warning" title={title} {...p} />;
/** Capacidad prevista en la hoja de ruta, aún no construida. */
export const ComingSoonState = ({ title = 'Próximamente', ...p }: P) => (
  <StateBlock icon={Rocket} tone="ai" title={title} {...p} />
);
