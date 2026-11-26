import {
  BookOpen,
  Brain,
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
import { brandContextCompleteness } from '@/lib/brain/types';
import { cn } from '@/lib/cn';
import type { IntelMeta, PostIntel } from '@/lib/intel/schema';
import { FoxyMark } from './foxy';
import { RecommendationAction } from './intel-client';
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
  return (
    <section
      aria-labelledby="foxy-intel-title"
      id="foxy"
      className="rounded-panel border-ai-fg/20 shadow-lift scroll-mt-24 overflow-hidden border"
    >
      <header className="relative flex flex-wrap items-start gap-4 bg-gradient-to-br from-[hsl(var(--ai-bg))] via-[hsl(var(--primary-pale))] to-[hsl(var(--card))] p-4 sm:p-5">
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
        <nav
          aria-label="Capas del análisis"
          className="flex w-full flex-wrap gap-1.5 text-xs font-extrabold"
        >
          {[
            ['#capa-contenido', 'Contenido'],
            ['#capa-rendimiento', 'Rendimiento'],
            ['#capa-estrategia', 'Estrategia'],
            ['#capa-creatividad', 'Creatividad'],
            ['#capa-reputacion', 'Reputación'],
          ].map(([h, l]) => (
            <a
              key={h}
              href={h}
              className="bg-card/80 hover:bg-card rounded-full px-3 py-1"
            >
              {l}
            </a>
          ))}
        </nav>
      </header>
      {!intel ? (
        <p className="bg-card p-5 text-sm">
          {disabledReason ?? 'Análisis no disponible.'}
        </p>
      ) : (
        <div className="bg-card space-y-6 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Chip label="Temática" value={intel.content.theme} />
            <Chip label="Territorio" value={intel.content.territory} />
            <Chip label="Formato" value={intel.content.format} />
            <Chip label="Objetivo probable" value={intel.content.objective} />
            <Chip label="Pilar de contenido" value={intel.strategic.pillar} />
            <Chip label="Campaña" value={intel.strategic.campaign} />
            <Chip label="Hook" value={intel.content.hook} />
            <Chip label="Llamado a la acción" value={intel.content.cta} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <Layer
              id="capa-contenido"
              icon={FileText}
              title="Content Intelligence"
              subtitle="Temática, formato, copy, hook y CTA"
            >
              {intel.content.findings.map((f, i) => (
                <FindingCard key={i} f={f} postHref={postHref} />
              ))}
              <p className="text-muted-foreground text-xs">
                Análisis visual: no disponible en el motor local (requiere un
                proveedor de IA con visión autorizado).
              </p>
            </Layer>
            <Layer
              id="capa-rendimiento"
              icon={TrendingUp}
              title="Performance Intelligence"
              subtitle={`Comparación con ${intel.performance.peers} publicaciones equivalentes del periodo`}
            >
              {intel.performance.findings.map((f, i) => (
                <FindingCard key={i} f={f} postHref={postHref} />
              ))}
            </Layer>
            <Layer
              id="capa-estrategia"
              icon={Compass}
              title="Strategic Intelligence"
              subtitle="Alineación con Foxy Brand Brain"
            >
              {intel.strategic.findings.map((f, i) => (
                <StrategicInsightCard key={i} f={f} postHref={postHref} />
              ))}
              {intel.strategic.status === 'no_context' && (
                <Link
                  href={brandHref}
                  className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
                >
                  <Brain aria-hidden className="h-4 w-4" /> Completar Foxy Brand
                  Brain
                </Link>
              )}
            </Layer>
            <Layer
              id="capa-creatividad"
              icon={Lightbulb}
              title="Creative Intelligence"
              subtitle="Oportunidades, hooks, CTA y pruebas A/B"
            >
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
              {intel.creative.hooks.length > 0 && (
                <CreativeOpportunityCard
                  f={{
                    kind: 'recommendation',
                    title: 'Hooks alternativos',
                    detail:
                      'Propuestas para probar; no se publican automáticamente.',
                    evidence: [],
                    confidence: null,
                    limitation: null,
                  }}
                  extras={intel.creative.hooks}
                />
              )}
              {intel.creative.abTests.map((t, i) => (
                <CreativeOpportunityCard
                  key={i}
                  f={{
                    kind: 'recommendation',
                    title: 'Prueba A/B sugerida',
                    detail: t.hypothesis,
                    evidence: [],
                    confidence: 'baja',
                    limitation: 'Mantén igual formato, horario y pauta.',
                  }}
                  extras={[
                    `A: ${t.variantA}`,
                    `B: ${t.variantB}`,
                    `Métrica: ${t.metric}`,
                  ]}
                  action={save(
                    'Prueba A/B propuesta',
                    `${t.hypothesis} A: ${t.variantA} · B: ${t.variantB} · Métrica: ${t.metric}`,
                  )}
                />
              ))}
              {intel.creative.ctas.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  CTA alternativos:{' '}
                  {intel.creative.ctas.map((c) => `«${c}»`).join(' · ')}
                </p>
              )}
            </Layer>
          </div>

          <Layer
            id="capa-reputacion"
            icon={ShieldAlert}
            title="Reputation Intelligence"
          >
            <div className="bg-muted/70 rounded-xl p-3.5 text-sm">
              <p className="font-extrabold">
                {intel.reputation.status === 'disabled_privacy'
                  ? 'Análisis reputacional no disponible'
                  : 'Sin datos reputacionales'}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {intel.reputation.reason}
              </p>
            </div>
          </Layer>

          <FutureActions />

          {intel.limitations.length > 0 && (
            <ul className="text-muted-foreground border-border space-y-0.5 border-t pt-3 text-xs">
              {intel.limitations.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
          )}
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

/** Resumen de Foxy Brand Brain (contexto estratégico autorizado). */
export function BrandContextCard({
  stored,
  href,
  availability,
}: {
  stored: StoredBrandContext | null;
  href: string;
  availability: 'ready' | 'needs_migration';
}) {
  const c: BrandContext | null = stored?.context ?? null;
  const comp = c
    ? brandContextCompleteness(c)
    : { score: 0, missing: [] as string[] };
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
      ) : !c ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Sin contexto estratégico: Foxy no evalúa alineación ni inventa
          pilares.
        </p>
      ) : (
        <>
          <div
            className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={comp.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Completitud del contexto"
          >
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${comp.score}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {comp.score} % de los campos esenciales ·{' '}
            {c.strategy.pillars.length} pilares ·{' '}
            {c.campaigns.filter((x) => x.status === 'active').length} campañas
            activas
          </p>
        </>
      )}
      <Link
        href={href}
        className="text-primary-text mt-2 inline-block text-xs font-extrabold"
      >
        Abrir Brand Brain
      </Link>
    </section>
  );
}
