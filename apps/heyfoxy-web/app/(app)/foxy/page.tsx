import { Compass, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { BrandContextCard } from '@/components/ds/intel';
import { AskFoxyContextual } from '@/components/ds/intel-client';
import { FindingCard } from '@/components/ds/intel-findings';
import { ModuleSurface, PageHeaderV2 } from '@/components/ds/layout';
import { Panel, PanelHeader } from '@/components/ds/primitives';
import { NetworkIcon } from '@/components/ds/network-icons';
import { requireContext } from '@/lib/auth/session';
import { brainAvailability, getBrandContext } from '@/lib/brain/store';
import { cn } from '@/lib/cn';
import { PLATFORM_LABEL } from '@/lib/format';
import { inWindow } from '@/lib/home-insights';
import { askFoxy } from '@/lib/intel/engine';
import { BRAND_QUESTIONS } from '@/lib/intel/local';
import {
  PERIOD_PARAM,
  parsePeriod,
  periodDays,
  periodLabel,
  withPeriod,
} from '@/lib/period';
import type { Platform } from '@/lib/types';

export const metadata = { title: 'Ask Foxy' };

/**
 * Ask Foxy a nivel de marca (WO fase C): consultas sobre un conjunto de publicaciones, una red,
 * un periodo o el rendimiento general, con referencias a las publicaciones y métricas usadas.
 */
export default async function FoxyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const period = parsePeriod(sp[PERIOD_PARAM]);
  const platform = (
    ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube'].includes(
      sp.red ?? '',
    )
      ? sp.red
      : null
  ) as Platform | null;
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const all = inWindow(await repo.posts(orgId), periodDays(period));
  const posts = platform ? all.filter((p) => p.platform === platform) : all;
  const networks = [...new Set(all.map((p) => p.platform))];
  const stored = await getBrandContext(orgId);
  const brand = stored?.context ?? null;
  const pl = periodLabel(period);
  const base = { orgId, post: null, peers: posts, brand, periodLabel: pl };
  const top = askFoxy({ ...base, question: BRAND_QUESTIONS[0] });
  const formats = askFoxy({ ...base, question: BRAND_QUESTIONS[1] });
  const postHref = (id: string) =>
    withPeriod(`/publicaciones/${encodeURIComponent(id)}`, period);
  const scope = `${active.organization.name} · ${platform ? PLATFORM_LABEL[platform] : 'todas las redes'} · ${pl.toLowerCase()} · ${posts.length} publicaciones`;
  const chip = (red: Platform | null, label: string) => (
    <Link
      key={label}
      href={withPeriod(`/foxy${red ? `?red=${red}` : ''}`, period)}
      aria-current={red === platform ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-extrabold',
        red === platform
          ? 'border-brand bg-brand text-brand-foreground'
          : 'border-border bg-card hover:bg-muted',
      )}
    >
      {red && <NetworkIcon platform={red} size={16} />}
      {label}
    </Link>
  );

  return (
    <ModuleSurface module="home">
      <PageHeaderV2
        icon={Sparkles}
        tone="ai"
        eyebrow="Foxy"
        title="Ask Foxy"
        description="Pregunta por tus publicaciones, una red, un periodo o el rendimiento de la marca. Foxy responde con evidencia y separa hechos, interpretaciones, hipótesis y recomendaciones."
      />
      <nav aria-label="Red" className="mb-4 flex flex-wrap gap-1.5">
        {chip(null, 'Todas las redes')}
        {networks.map((n) => chip(n, PLATFORM_LABEL[n]))}
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <AskFoxyContextual
            postId={null}
            period={period}
            platform={platform}
            suggestions={BRAND_QUESTIONS}
            scopeLabel={scope}
            postHrefPattern={withPeriod('/publicaciones/{id}', period)}
          />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Panel aria-labelledby="foxy-top">
              <PanelHeader
                icon={TrendingUp}
                title="Mejor rendimiento del periodo"
                titleId="foxy-top"
                description="Por engagement, con su publicación de referencia."
              />
              <div className="space-y-2">
                {top.answer.findings.map((f, i) => (
                  <FindingCard key={i} f={f} postHref={postHref} compact />
                ))}
              </div>
            </Panel>
            <Panel aria-labelledby="foxy-fmt">
              <PanelHeader
                icon={Compass}
                title="Formatos por red"
                titleId="foxy-fmt"
                description="Mediana de engagement con al menos 2 publicaciones."
              />
              <div className="space-y-2">
                {formats.answer.findings.length ? (
                  formats.answer.findings.map((f, i) => (
                    <FindingCard key={i} f={f} postHref={postHref} compact />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Sin base suficiente en el periodo.
                  </p>
                )}
              </div>
            </Panel>
          </div>
        </div>
        <aside className="space-y-4 lg:col-span-4">
          <BrandContextCard
            stored={stored}
            href={withPeriod('/brand-brain', period)}
            availability={brainAvailability()}
          />
          <Panel aria-labelledby="foxy-how">
            <PanelHeader
              icon={Sparkles}
              title="Cómo responde Foxy"
              titleId="foxy-how"
            />
            <ul className="text-muted-foreground space-y-1.5 text-[13px]">
              <li>
                · Motor local por reglas: sin IA generativa y sin enviar datos
                fuera de Hey Foxy.
              </li>
              <li>
                · Solo usa publicaciones y métricas de esta organización en el
                periodo elegido.
              </li>
              <li>· Si no puede responder con evidencia, lo dice.</li>
              <li>
                · Las preguntas abiertas requerirán un proveedor de IA
                autorizado (pendiente de GO).
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </ModuleSurface>
  );
}
