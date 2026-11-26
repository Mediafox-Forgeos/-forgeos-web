import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  FileText,
  FlaskConical,
  Lightbulb,
  Link2,
  Scale,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import {
  FINDING_KIND_LABEL,
  type Evidence,
  type Finding,
  type FindingKind,
} from '@/lib/intel/schema';

/*
 * Hallazgos de Foxy (DS V2 · addendum §7F). La naturaleza de cada afirmación se ve siempre:
 * HECHO (azul), INTERPRETACIÓN (violeta), HIPÓTESIS (ámbar), RECOMENDACIÓN (verde).
 * Componentes sin estado: sirven en servidor y en cliente.
 */
const KIND: Record<
  FindingKind,
  { cls: string; icon: LucideIcon; rail: string }
> = {
  fact: {
    cls: 'bg-info-bg text-info-fg',
    icon: BadgeCheck,
    rail: 'bg-info-fg',
  },
  interpretation: {
    cls: 'bg-ai-bg text-ai-fg',
    icon: Sparkles,
    rail: 'bg-ai-fg',
  },
  hypothesis: {
    cls: 'bg-warning-bg text-warning-fg',
    icon: FlaskConical,
    rail: 'bg-warning-fg',
  },
  recommendation: {
    cls: 'bg-success-bg text-success-fg',
    icon: Lightbulb,
    rail: 'bg-success-fg',
  },
};

export function FindingKindBadge({ kind }: { kind: FindingKind }) {
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide',
        k.cls,
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {FINDING_KIND_LABEL[kind]}
    </span>
  );
}

const EV_ICON: Record<Evidence['type'], LucideIcon> = {
  post: Link2,
  metric: BarChart3,
  brand: BookOpen,
  document: FileText,
  comparison: Scale,
};

/** Referencia a la evidencia usada (publicación, métrica, Brand Brain, documento, comparación). */
export function EvidenceReference({
  e,
  postHref,
}: {
  e: Evidence;
  postHref?: (id: string) => string;
}) {
  const Icon = EV_ICON[e.type];
  const body = (
    <>
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">{e.label}</span>
      {e.value && <b className="shrink-0">· {e.value}</b>}
    </>
  );
  const cls =
    'bg-muted text-muted-foreground inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold';
  return e.postId && postHref ? (
    <Link
      href={postHref(e.postId)}
      className={cn(
        cls,
        'hover:text-foreground underline-offset-2 hover:underline',
      )}
    >
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export function FindingCard({
  f,
  postHref,
  compact = false,
  action,
}: {
  f: Finding;
  postHref?: (id: string) => string;
  compact?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'bg-card border-border/80 relative overflow-hidden rounded-xl border',
        compact ? 'p-3' : 'p-3.5',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', KIND[f.kind].rail)}
      />
      <div className="flex flex-wrap items-center gap-1.5 pl-1.5">
        <FindingKindBadge kind={f.kind} />
        {f.confidence && (
          <span className="text-muted-foreground text-[11px] font-bold">
            Confianza {f.confidence}
          </span>
        )}
      </div>
      <h4 className="mt-1.5 pl-1.5 text-sm font-extrabold leading-snug">
        {f.title}
      </h4>
      {f.detail && (
        <p className="text-muted-foreground mt-1 pl-1.5 text-[13px] leading-snug">
          {f.detail}
        </p>
      )}
      {f.evidence.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1 pl-1.5"
          aria-label="Evidencia"
        >
          {f.evidence.map((e, i) => (
            <EvidenceReference key={i} e={e} postHref={postHref} />
          ))}
        </div>
      )}
      {f.limitation && (
        <p className="text-muted-foreground mt-1.5 pl-1.5 text-[11.5px] italic">
          Limitación: {f.limitation}
        </p>
      )}
      {action && <div className="mt-2 pl-1.5">{action}</div>}
    </article>
  );
}

/** Hallazgo estratégico (Brand Brain): misma anatomía, acento de marca. */
export function StrategicInsightCard(props: Parameters<typeof FindingCard>[0]) {
  return <FindingCard {...props} />;
}

/** Oportunidad creativa: recomendación con sus propuestas (hooks, CTA, formato). */
export function CreativeOpportunityCard({
  f,
  extras,
  postHref,
  action,
}: {
  f: Finding;
  extras?: string[];
  postHref?: (id: string) => string;
  action?: React.ReactNode;
}) {
  return (
    <FindingCard
      f={f}
      postHref={postHref}
      action={
        <>
          {extras && extras.length > 0 && (
            <ul className="mb-2 space-y-1">
              {extras.map((x) => (
                <li
                  key={x}
                  className="bg-success-bg/60 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold"
                >
                  {x}
                </li>
              ))}
            </ul>
          )}
          {action}
        </>
      }
    />
  );
}
