import {
  AlertTriangle,
  CircleSlash,
  Cpu,
  FlaskConical,
  ImageOff,
  Info,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { FallbackCode, GenMeta } from '@/lib/intel/ai/engine';
import { MEDIA_COVERAGE_LABEL } from '@/lib/intel/ai/labels';

/*
 * Estados del Foxy Intelligence Engine (DS v0.5 · EngineBadge y AiStateNotice).
 * Una respuesta siempre dice qué motor la produjo: motor local por reglas, IA generativa
 * (modelo exacto), simulación con fixtures (nunca presentada como IA real) o respaldo local
 * con el motivo. Ningún estado se simula: cada uno refleja lo que ocurrió.
 */

export type EngineBadgeState =
  'local' | 'available' | 'generative' | 'simulated' | 'fallback';

const BADGE: Record<EngineBadgeState, { cls: string; icon: typeof Cpu }> = {
  local: { cls: 'bg-muted text-muted-foreground', icon: Cpu },
  available: { cls: 'bg-ai-bg text-ai-fg', icon: Sparkles },
  generative: { cls: 'bg-ai-bg text-ai-fg', icon: Sparkles },
  simulated: { cls: 'bg-warning-bg text-warning-fg', icon: FlaskConical },
  fallback: { cls: 'bg-warning-bg text-warning-fg', icon: CircleSlash },
};

export function EngineBadge({
  state,
  label,
  className,
}: {
  state: EngineBadgeState;
  label: string;
  className?: string;
}) {
  const b = BADGE[state];
  const Icon = b.icon;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
        b.cls,
        className,
      )}
      data-engine={state}
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Insignia a partir de los metadatos de una respuesta o análisis. */
export function MetaBadge({ meta }: { meta: GenMeta }) {
  const state: EngineBadgeState =
    meta.state === 'generative'
      ? 'generative'
      : meta.state === 'simulated'
        ? 'simulated'
        : meta.state === 'fallback'
          ? 'fallback'
          : 'local';
  const label =
    meta.state === 'fallback'
      ? 'Respaldo: motor local por reglas'
      : meta.local
        ? 'Motor local por reglas · sin IA generativa'
        : meta.modelLabel;
  return <EngineBadge state={state} label={label} />;
}

export type NoticeTone = 'info' | 'warning' | 'critical' | 'neutral';

const TONE: Record<NoticeTone, string> = {
  info: 'border-ai-fg/25 bg-ai-bg text-foreground',
  warning: 'border-warning-fg/30 bg-warning-bg text-foreground',
  critical: 'border-critical-fg/30 bg-critical-bg text-foreground',
  neutral: 'border-border bg-muted/60 text-foreground',
};
const TONE_ICON: Record<NoticeTone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
  neutral: Info,
};

export function AiStateNotice({
  tone,
  title,
  children,
  icon,
  action,
}: {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  icon?: typeof Info;
  action?: ReactNode;
}) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-xl border px-3 py-2.5', TONE[tone])}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="font-extrabold">{title}</p>
        {children && (
          <div className="text-muted-foreground mt-0.5">{children}</div>
        )}
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  );
}

const FALLBACK_TITLE: Record<
  FallbackCode,
  { title: string; tone: NoticeTone; icon?: typeof Info }
> = {
  not_enabled: { title: 'IA generativa no activada', tone: 'neutral' },
  misconfigured: { title: 'IA generativa sin configurar', tone: 'warning' },
  kill_switch: {
    title: 'IA generativa detenida por el interruptor de emergencia',
    tone: 'warning',
  },
  not_authorized_data: {
    title: 'Datos reales sin autorización para IA externa',
    tone: 'neutral',
  },
  sensitive: {
    title: 'Contenido sensible: no se envía al proveedor',
    tone: 'warning',
  },
  budget: { title: 'Presupuesto de IA agotado', tone: 'warning', icon: Wallet },
  provider_error: { title: 'Error del proveedor de IA', tone: 'critical' },
  invalid_output: {
    title: 'Respuesta descartada por no cumplir el formato',
    tone: 'critical',
  },
  isolation: { title: 'Contexto rechazado por aislamiento', tone: 'critical' },
};

/** Aviso del respaldo local con su motivo (presupuesto, error, datos no autorizados…). */
export function FallbackNotice({ meta }: { meta: GenMeta }) {
  if (!meta.fallback || meta.fallback.code === 'not_enabled') return null;
  const f = FALLBACK_TITLE[meta.fallback.code];
  return (
    <AiStateNotice tone={f.tone} title={f.title} icon={f.icon}>
      {meta.fallback.reason} Se muestra el análisis del motor local por reglas.
    </AiStateNotice>
  );
}

/** Contexto estratégico insuficiente (Brand Brain vacío o incompleto). */
export function BrandContextNotice({
  status,
  version,
  href,
}: {
  status: GenMeta['brandStatus'];
  version: number | null;
  href: string;
}) {
  if (status === 'ok') return null;
  return (
    <AiStateNotice
      tone="info"
      title={
        status === 'missing'
          ? 'Contexto estratégico no disponible'
          : `Contexto estratégico incompleto (Brand Brain v${version ?? '—'})`
      }
      action={
        <a
          href={href}
          className="text-primary-text text-xs font-extrabold underline-offset-2 hover:underline"
        >
          Completar Foxy Brand Brain
        </a>
      }
    >
      Sin objetivos, pilares y campañas autorizados, Foxy no evalúa la
      alineación estratégica ni los supone.
    </AiStateNotice>
  );
}

/** Cobertura del análisis visual (multimodal parcial, imagen no disponible o caducada). */
export function MediaCoverageNote({ meta }: { meta: GenMeta }) {
  if (!meta.mediaCoverage || meta.mediaCoverage === 'image_full') {
    return meta.mediaCoverage === 'image_full' ? (
      <EngineBadge state="generative" label={MEDIA_COVERAGE_LABEL.image_full} />
    ) : null;
  }
  const partial =
    meta.mediaCoverage === 'carousel_cover' ||
    meta.mediaCoverage === 'video_thumbnail';
  return (
    <AiStateNotice
      tone={partial ? 'info' : 'neutral'}
      icon={partial ? undefined : ImageOff}
      title={
        partial
          ? `Análisis multimodal parcial · ${MEDIA_COVERAGE_LABEL[meta.mediaCoverage]}`
          : MEDIA_COVERAGE_LABEL[meta.mediaCoverage]
      }
    >
      {meta.mediaStatement}
    </AiStateNotice>
  );
}

/** Ajustes que el código aplicó a la salida del modelo (transparencia). */
export function AdjustmentsNote({ meta }: { meta: GenMeta }) {
  if (!meta.adjustments.length && !meta.droppedEvidence) return null;
  return (
    <details className="text-muted-foreground text-[12px]">
      <summary className="cursor-pointer font-extrabold">
        Verificación aplicada por Hey Foxy (
        {meta.adjustments.length + (meta.droppedEvidence ? 1 : 0)})
      </summary>
      <ul className="mt-1 space-y-0.5">
        {meta.droppedEvidence > 0 && (
          <li>
            · {meta.droppedEvidence} referencia(s) citada(s) por el modelo no
            existían en los datos y se descartaron.
          </li>
        )}
        {meta.adjustments.map((a) => (
          <li key={a}>· {a}</li>
        ))}
      </ul>
    </details>
  );
}
