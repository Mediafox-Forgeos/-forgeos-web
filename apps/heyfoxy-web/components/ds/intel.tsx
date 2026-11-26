import {
  ArrowRight,
  BookOpen,
  Brain,
  Info,
  PlugZap,
  ShieldCheck,
  Compass,
  FileText,
  Lightbulb,
  MessagesSquare,
  Rocket,
  Share2,
  ShieldAlert,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BrandContext, StoredBrandContext } from '@/lib/brain/types';
import { brandContextCompleteness, emptyBrandContext } from '@/lib/brain/types';
import { cn } from '@/lib/cn';
import { BRIEF_AREA_LABEL, type BriefItem } from '@/lib/intel/brand';
import type { Finding, IntelMeta, PostIntel } from '@/lib/intel/schema';
import { summarizePostIntel } from '@/lib/intel/summary';
import { FoxyMark } from './foxy';
import { IntelligenceTabs, RecommendationAction } from './intel-client';
import {
  CreativeOpportunityCard,
  FindingCard,
  StrategicInsightCard,
} from './intel-findings';

/*
 * Foxy Content Intelligence (DS V2 · addendum §7): «¿Qué podemos aprender de esta
 * publicación?». Capas: contenido, rendimiento, estrategia (Brand Brain), creatividad,
 * reputación y recomendaciones accionables. Protagonista visual de Social Explorer.
 */

function Layer({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-t`}
      id={id}
      className={cn('scroll-mt-24', className)}
    >
      <h3
        id={`${id}-t`}
        className="flex items-center gap-2 text-sm font-extrabold"
      >
        <span
          aria-hidden
          className="bg-ai-bg text-ai-fg flex h-7 w-7 items-center justify-center rounded-lg"
        >
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h3>
      {subtitle && (
        <p className="text-muted-foreground mt-0.5 pl-9 text-xs">{subtitle}</p>
      )}
      <div className="mt-2.5 space-y-2">{children}</div>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card/80 border-border/70 min-w-0 rounded-xl border px-3 py-2">
      <p className="text-muted-foreground text-[10.5px] font-extrabold uppercase tracking-wider">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-[13px] font-extrabold',
          !value && 'text-muted-foreground font-semibold',
        )}
        title={value ?? undefined}
      >
        {value ?? 'Sin determinar'}
      </p>
    </div>
  );
}

export function FoxyContentIntelligence({
  intel,
  meta,
  postId,
  postHref,
  canSave,
  saveDisabledReason,
  brandHref,
  disabledReason,
}: {
  intel: PostIntel | null;
  meta: IntelMeta;
  postId: string;
  postHref: (id: string) => string;
  canSave: boolean;
  saveDisabledReason?: string;
  brandHref: string;
  disabledReason?: string;
}) {
  const save = (title: string, body: string) => (
    <RecommendationAction
      title={title}
      body={body}
      postId={postId}
      canSave={canSave}
      saveDisabledReason={saveDisabledReason}
    />
  );
  const summary = intel ? summarizePostIntel(intel) : null;
  const abVariants = new Set(intel?.creative.abTests.map((t) => t.variantB));
  const hooks = intel?.creative.hooks.filter((h) => !abVariants.has(h)) ?? [];
  return (
    <section
      aria-labelledby="foxy-intel-title"
      id="foxy"
      className="rounded-panel border-ai-fg/20 shadow-lift scroll-mt-24 border"
    >
      <header className="rounded-t-panel flex flex-wrap items-start gap-4 bg-gradient-to-br from-[hsl(var(--ai-bg))] via-[hsl(var(--primary-pale))] to-[hsl(var(--card))] p-4 sm:p-5">
        <FoxyMark size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-ai-fg text-[11px] font-extrabold uppercase tracking-wider">
            Foxy Content Intelligence
          </p>
          <h2
            id="foxy-intel-title"
            className="text-lg font-extrabold leading-tight sm:text-xl"
          >
            ¿Qué podemos aprender de esta publicación?
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {meta.local
              ? 'Motor local por reglas · sin IA generativa'
              : `${meta.provider} · ${meta.model}`}
            {meta.cached ? ' · análisis en caché (sin cambios)' : ''}
            {meta.syntheticInput ? ' · datos sintéticos de prueba' : ''}
          </p>
        </div>
      </header>
      {!intel || !summary ? (
        <p className="bg-card rounded-b-panel p-5 text-sm">
          {disabledReason ?? 'Análisis no disponible.'}
        </p>
      ) : (
        <div className="bg-card rounded-b-panel p-4 sm:p-5">
          <IntelligenceTabs
            label="Dimensiones del análisis"
            tabs={[
              {
                id: 'resumen',
                label: 'Resumen',
                content: (
                  <ExecutiveInsightSummary
                    findings={summary.findings}
                    recommendations={summary.recommendations}
                    postHref={postHref}
                    renderAction={(f) =>
                      save(
                        f.title,
                        `${f.detail}${f.limitation ? ` (Limitación: ${f.limitation})` : ''}`,
                      )
                    }
                  />
                ),
              },
              {
                id: 'contenido',
                label: 'Contenido',
                badge: String(intel.content.findings.length),
                content: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <Chip label="Temática" value={intel.content.theme} />
                      <Chip
                        label="Territorio"
                        value={intel.content.territory}
                      />
                      <Chip label="Formato" value={intel.content.format} />
                      <Chip
                        label="Objetivo probable"
                        value={intel.content.objective}
                      />
                      <Chip label="Hook" value={intel.content.hook} />
                      <Chip
                        label="Llamado a la acción"
                        value={
                          intel.content.ctaInHook
                            ? 'Incluido en la frase del hook'
                            : intel.content.cta
                        }
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 xl:grid-cols-2">
                      {intel.content.findings.map((f, i) => (
                        <FindingCard key={i} f={f} postHref={postHref} />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Análisis visual: no disponible en el motor local (requiere
                      un proveedor de IA con visión autorizado).
                    </p>
                  </div>
                ),
              },
              {
                id: 'rendimiento',
                label: 'Rendimiento',
                badge: String(intel.performance.findings.length),
                content: (
                  <Layer
                    id="capa-rendimiento"
                    icon={TrendingUp}
                    title="Performance Intelligence"
                    subtitle={`Comparación con ${intel.performance.peers} publicaciones equivalentes (misma red y tipo de formato) del periodo`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 xl:grid-cols-2">
                      {intel.performance.findings.map((f, i) => (
                        <FindingCard key={i} f={f} postHref={postHref} />
                      ))}
                    </div>
                  </Layer>
                ),
              },
              {
                id: 'estrategia',
                label: 'Estrategia',
                content: (
                  <Layer
                    id="capa-estrategia"
                    icon={Compass}
                    title="Strategic Intelligence"
                    subtitle="Alineación con Foxy Brand Brain"
                  >
                    <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                      <Chip
                        label="Pilar de contenido"
                        value={intel.strategic.pillar}
                      />
                      <Chip label="Campaña" value={intel.strategic.campaign} />
                    </div>
                    {intel.strategic.findings.map((f, i) => (
                      <StrategicInsightCard key={i} f={f} postHref={postHref} />
                    ))}
                    {intel.strategic.status === 'no_context' && (
                      <Link
                        href={brandHref}
                        className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
                      >
                        <Brain aria-hidden className="h-4 w-4" /> Completar Foxy
                        Brand Brain
                      </Link>
                    )}
                  </Layer>
                ),
              },
              {
                id: 'creatividad',
                label: 'Creatividad',
                badge: String(
                  intel.creative.findings.length +
                    intel.creative.abTests.length,
                ),
                content: (
                  <Layer
                    id="capa-creatividad"
                    icon={Lightbulb}
                    title="Creative Intelligence"
                    subtitle="Oportunidades, hooks, CTA y pruebas A/B"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 xl:grid-cols-2">
                      {intel.creative.findings.map((f, i) => (
                        <CreativeOpportunityCard
                          key={i}
                          f={f}
                          postHref={postHref}
                          action={save(
                            f.title,
                            `${f.detail}${f.limitation ? ` (Limitación: ${f.limitation})` : ''}`,
                          )}
                        />
                      ))}
                      {intel.creative.abTests.map((t, i) => (
                        <CreativeOpportunityCard
                          key={`ab${i}`}
                          f={{
                            kind: 'recommendation',
                            title: 'Prueba A/B sugerida',
                            detail: t.hypothesis,
                            evidence: [],
                            confidence: 'baja',
                            limitation:
                              'Mantén igual formato, horario y pauta.',
                          }}
                          extras={[
                            `A (actual): ${t.variantA}`,
                            `B: ${t.variantB}`,
                            `Métrica: ${t.metric}`,
                          ]}
                          action={save(
                            'Prueba A/B propuesta',
                            `${t.hypothesis} A: ${t.variantA} · B: ${t.variantB} · Métrica: ${t.metric}`,
                          )}
                        />
                      ))}
                      {hooks.length > 0 && (
                        <CreativeOpportunityCard
                          f={{
                            kind: 'recommendation',
                            title: 'Otros hooks para probar',
                            detail:
                              'Plantillas por reglas a partir de la temática; no se publican automáticamente.',
                            evidence: [],
                            confidence: null,
                            limitation: null,
                          }}
                          extras={hooks}
                        />
                      )}
                    </div>
                    {intel.creative.ctas.length > 0 && (
                      <p className="text-muted-foreground text-xs">
                        CTA alternativos:{' '}
                        {intel.creative.ctas.map((c) => `«${c}»`).join(' · ')}
                      </p>
                    )}
                  </Layer>
                ),
              },
              {
                id: 'reputacion',
                label: 'Reputación',
                content: (
                  <CoverageStatus
                    state={
                      intel.reputation.status === 'disabled_privacy'
                        ? 'privacy_disabled'
                        : intel.reputation.status === 'available'
                          ? 'available'
                          : 'no_conversations'
                    }
                    detail={intel.reputation.reason}
                  />
                ),
              },
            ]}
          />
          <div className="border-border mt-5 space-y-3 border-t pt-4">
            {intel.limitations.length > 0 && (
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {intel.limitations.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
            )}
            <FutureActions />
          </div>
        </div>
      )}
    </section>
  );
}

/** Resumen ejecutivo (3–5 hallazgos prioritarios + recomendaciones). */
export function ExecutiveInsightSummary({
  findings,
  recommendations,
  postHref,
  renderAction,
}: {
  findings: Finding[];
  recommendations: Finding[];
  postHref?: (id: string) => string;
  renderAction?: (f: Finding) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-5">
      <div className="space-y-2 xl:col-span-3">
        <p className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
          Lo más importante
        </p>
        {findings.map((f, i) => (
          <FindingCard key={i} f={f} postHref={postHref} />
        ))}
      </div>
      <div className="space-y-2 xl:col-span-2">
        <p className="text-success-fg text-[11px] font-extrabold uppercase tracking-wider">
          Recomendaciones
        </p>
        {recommendations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Sin recomendaciones con base suficiente para esta publicación.
          </p>
        ) : (
          recommendations.map((f, i) => (
            <FindingCard
              key={i}
              f={f}
              postHref={postHref}
              action={renderAction?.(f)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export type CoverageState =
  | 'available'
  | 'no_conversations'
  | 'not_imported'
  | 'not_connected'
  | 'privacy_disabled';

const COVERAGE: Record<
  CoverageState,
  { title: string; tone: string; icon: LucideIcon }
> = {
  available: {
    title: 'Análisis reputacional disponible',
    tone: 'bg-success-bg text-success-fg',
    icon: ShieldCheck,
  },
  no_conversations: {
    title: 'Sin conversaciones detectadas',
    tone: 'bg-muted text-muted-foreground',
    icon: MessagesSquare,
  },
  not_imported: {
    title: 'Comentarios no importados',
    tone: 'bg-info-bg text-info-fg',
    icon: Info,
  },
  not_connected: {
    title: 'Fuente de conversación no conectada',
    tone: 'bg-warning-bg text-warning-fg',
    icon: PlugZap,
  },
  privacy_disabled: {
    title: 'Análisis desactivado por privacidad',
    tone: 'bg-ai-bg text-ai-fg',
    icon: ShieldAlert,
  },
};

/**
 * Estado de cobertura de la conversación (DS v0.4 · CoverageStatus). Distingue «no hay
 * conversación» de «no se importa», «no está conectada» y «desactivado por privacidad»: la
 * ausencia de comentarios nunca se presenta como ausencia de conversación.
 */
export function CoverageStatus({
  state,
  detail,
  compact = false,
}: {
  state: CoverageState;
  detail?: string | null;
  compact?: boolean;
}) {
  const c = COVERAGE[state];
  const Icon = c.icon;
  return (
    <div
      className={cn(
        'border-border/70 flex items-start gap-3 rounded-xl border',
        compact ? 'p-2.5' : 'p-3.5',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          c.tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{c.title}</p>
        {detail && (
          <p className="text-muted-foreground mt-0.5 text-[13px]">{detail}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Foxy Executive Brief (DS v0.4): «¿Qué debería saber hoy el director de marca?». Entre 3 y 5
 * hallazgos priorizados con evidencia, limitación y acceso al detalle. Identifica el motor.
 */
export function FoxyExecutiveBrief({
  items,
  hrefFor,
  postHref,
  subtitle,
  footer,
}: {
  items: BriefItem[];
  hrefFor: (href: string) => string;
  postHref: (id: string) => string;
  subtitle: string;
  footer?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="brief-title"
      className="rounded-panel border-ai-fg/20 shadow-lift border"
    >
      <header className="rounded-t-panel flex items-start gap-3 bg-gradient-to-br from-[hsl(var(--ai-bg))] via-[hsl(var(--primary-pale))] to-[hsl(var(--card))] p-4 sm:p-5">
        <FoxyMark size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-ai-fg text-[11px] font-extrabold uppercase tracking-wider">
            Foxy Executive Brief
          </p>
          <h2
            id="brief-title"
            className="text-lg font-extrabold leading-tight sm:text-xl"
          >
            ¿Qué debería saber hoy el director de marca?
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Motor local por reglas · sin IA generativa · {subtitle}
          </p>
        </div>
      </header>
      <ol className="bg-card divide-border divide-y">
        {items.map((it, i) => (
          <li key={i} className="p-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider">
                <span className="bg-ai-bg text-ai-fg flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                  {i + 1}
                </span>
                {BRIEF_AREA_LABEL[it.area]}
              </span>
              {it.href && (
                <Link
                  href={hrefFor(it.href)}
                  className="text-primary-text inline-flex items-center gap-1 text-xs font-extrabold"
                >
                  {it.hrefLabel ?? 'Ver detalle'}{' '}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div
              className={cn(
                'mt-2 grid grid-cols-[minmax(0,1fr)] gap-2',
                it.recommendation &&
                  'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
              )}
            >
              <FindingCard f={it.finding} postHref={postHref} />
              {it.recommendation && (
                <FindingCard f={it.recommendation} postHref={postHref} />
              )}
            </div>
          </li>
        ))}
      </ol>
      {footer && (
        <div className="bg-card rounded-b-panel border-border border-t px-4 py-3 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Próximas capacidades (addendum §9): visibles como roadmap, nunca simuladas. */
export function FutureActions() {
  const items: Array<[LucideIcon, string]> = [
    [FileText, 'Generar brief creativo'],
    [Rocket, 'Sugerir contenido para el cronopost'],
    [Target, 'Crear propuesta de prueba A/B'],
    [Share2, 'Compartir hallazgo'],
    [BookOpen, 'Recomendación ejecutiva'],
    [MessagesSquare, 'Enviar a MediaFOX OS o WhatsApp'],
  ];
  return (
    <div>
      <p className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
        Próximas capacidades
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map(([Icon, l]) => (
          <li key={l}>
            <span
              aria-disabled
              className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-bold"
            >
              <Icon aria-hidden className="h-3.5 w-3.5" /> {l} · próximamente
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Resumen de Foxy Brand Brain (contexto estratégico autorizado), con estado vacío útil. */
export function BrandContextCard({
  stored,
  href,
  availability,
  learnings,
  detailed = false,
}: {
  stored: StoredBrandContext | null;
  href: string;
  availability: 'ready' | 'needs_migration';
  /** Conteo de la memoria estratégica (propuestos / aprobados), si se conoce. */
  learnings?: { proposed: number; validated: number } | null;
  /** Muestra objetivos, pilares y campañas (Intelligence Home). */
  detailed?: boolean;
}) {
  const c: BrandContext | null = stored?.context ?? null;
  const comp = c
    ? brandContextCompleteness(c)
    : brandContextCompleteness(emptyBrandContext());
  const active = c?.campaigns.filter((x) => x.status === 'active') ?? [];
  return (
    <section
      aria-labelledby="bb-card"
      className="rounded-card border-border/80 bg-card shadow-card border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="bb-card"
          className="flex items-center gap-2 text-sm font-extrabold"
        >
          <Brain aria-hidden className="text-ai-fg h-4 w-4" /> Foxy Brand Brain
        </h2>
        {stored?.isSynthetic && (
          <span className="bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-[11px] font-bold">
            Sintético
          </span>
        )}
      </div>
      {availability === 'needs_migration' ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Pendiente de la migración 0007 (requiere GO). Foxy analiza sin
          contexto estratégico.
        </p>
      ) : (
        <>
          <div
            className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={comp.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Completitud del contexto estratégico"
          >
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${comp.score}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {comp.score} % de los campos esenciales
            {c
              ? ` · ${c.strategy.pillars.length} pilares · ${active.length} campañas activas`
              : ' · sin contexto estratégico'}
            {stored ? ` · versión ${stored.version}` : ''}
          </p>
          {!c && (
            <p className="mt-2 text-[13px]">
              Foxy aún no conoce la estrategia de la marca: no evalúa alineación
              ni inventa pilares. Empieza por los objetivos, los pilares y el
              tono.
            </p>
          )}
          {c && detailed && (
            <dl className="mt-3 space-y-2 text-[13px]">
              {c.strategy.communicationGoals.length > 0 && (
                <div>
                  <dt className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
                    Objetivos
                  </dt>
                  <dd>
                    {c.strategy.communicationGoals.slice(0, 2).join(' · ')}
                  </dd>
                </div>
              )}
              {c.strategy.pillars.length > 0 && (
                <div>
                  <dt className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
                    Pilares
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {c.strategy.pillars.map((p) => (
                      <span
                        key={p.name}
                        className="bg-ai-bg text-ai-fg rounded-full px-2 py-0.5 text-[11px] font-bold"
                      >
                        {p.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {active.length > 0 && (
                <div>
                  <dt className="text-muted-foreground text-[11px] font-extrabold uppercase tracking-wider">
                    Campañas activas
                  </dt>
                  <dd>{active.map((x) => x.name).join(' · ')}</dd>
                </div>
              )}
            </dl>
          )}
          {comp.missing.length > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              Falta: {comp.missing.slice(0, 4).join(', ')}
              {comp.missing.length > 4 ? '…' : ''}.
            </p>
          )}
          {learnings && (learnings.proposed > 0 || learnings.validated > 0) && (
            <p className="mt-2 text-xs">
              <b>{learnings.validated}</b> aprendizajes aprobados ·{' '}
              <b>{learnings.proposed}</b> pendientes de revisión
            </p>
          )}
        </>
      )}
      <Link
        href={href}
        className="text-primary-text mt-2 inline-flex items-center gap-1 text-xs font-extrabold"
      >
        {c ? 'Abrir Brand Brain' : 'Configurar Brand Brain'}
        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

/**
 * Composición responsive del centro de inteligencia (DS v0.4): la pieza principal (p. ej. la
 * publicación original) y, a su lado, las visualizaciones. Sin columnas fijas más altas que la
 * pantalla: ambas columnas fluyen con el documento. Una columna por debajo de lg.
 */
export function ResponsiveIntelligenceLayout({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-5">{primary}</div>
      <div className="min-w-0 space-y-4 lg:col-span-7">{secondary}</div>
    </div>
  );
}
