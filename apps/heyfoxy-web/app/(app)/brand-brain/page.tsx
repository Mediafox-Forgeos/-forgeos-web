import {
  Brain,
  BookOpen,
  CheckCircle2,
  Compass,
  History,
  Library,
  Megaphone,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { CopilotScope } from '@/components/ds/copilot';
import { BrandContextCard } from '@/components/ds/intel';
import {
  BrandBrainForm,
  LearningReviewCard,
} from '@/components/ds/learning-review';
import { ModuleSurface, PageHeaderV2 } from '@/components/ds/layout';
import { Panel, PanelHeader, StatusPill } from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import {
  brainAvailability,
  getBrandContext,
  listMemory,
  reviewAvailability,
} from '@/lib/brain/store';
import { brandContextCompleteness, emptyBrandContext } from '@/lib/brain/types';
import { fmtDateTime } from '@/lib/format';
import { BRAND_QUESTIONS } from '@/lib/intel/local';
import { PERIOD_PARAM, parsePeriod, withPeriod } from '@/lib/period';

export const metadata = { title: 'Foxy Brand Brain' };

const input =
  'bg-card border-border focus-visible:ring-primary-text w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-70';

function Field({
  name,
  label,
  hint,
  value,
  rows = 0,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  value: string;
  rows?: number;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold">{label}</span>
      {hint && (
        <span className="text-muted-foreground block text-xs">{hint}</span>
      )}
      {rows ? (
        <textarea
          name={name}
          defaultValue={value}
          rows={rows}
          disabled={disabled}
          className={`${input} mt-1`}
        />
      ) : (
        <input
          name={name}
          defaultValue={value}
          disabled={disabled}
          className={`${input} mt-1`}
        />
      )}
    </label>
  );
}

function Section({
  icon,
  title,
  id,
  children,
}: {
  icon: typeof Brain;
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <Panel aria-labelledby={id}>
      <PanelHeader icon={icon} title={title} titleId={id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {children}
      </div>
    </Panel>
  );
}

/**
 * Foxy Brand Brain (WO-HF-V2-INTELLIGENCE-001 fase D + addendum §2): contexto estratégico
 * autorizado de la marca. Lo escribe una persona (owner/admin); Foxy lo lee y nunca lo modifica.
 * No se inventa información: un campo vacío es un campo vacío.
 */
export default async function BrandBrainPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const period = parsePeriod(sp[PERIOD_PARAM]);
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const availability = brainAvailability();
  const reviewMode = reviewAvailability();
  const [stored, memory, members] = await Promise.all([
    getBrandContext(orgId),
    listMemory(orgId),
    repo.members(orgId),
  ]);
  const nameOf = (id: string | null | undefined) =>
    id ? (members.find((m) => m.userId === id)?.name ?? null) : null;
  const canReview = ['owner', 'admin'].includes(active.role);
  const pendingMem = memory.filter((m) => m.status === 'proposed');
  const historyMem = memory.filter((m) => m.status !== 'proposed');
  const periodQ = withPeriod('', period);
  const comp = brandContextCompleteness(stored?.context ?? emptyBrandContext());
  const synthetic = stored?.isSynthetic || active.organization.isDemo;
  const c = stored?.context ?? emptyBrandContext();
  const canEdit =
    ['owner', 'admin'].includes(active.role) && availability === 'ready';
  const ro = !canEdit;
  const join = (xs: string[]) => xs.join('\n');

  return (
    <ModuleSurface module="home">
      <PageHeaderV2
        icon={Brain}
        tone="ai"
        eyebrow="Foxy"
        title="Foxy Brand Brain"
        description={`Contexto estratégico autorizado de ${active.organization.name}. Foxy lo usa para personalizar sus análisis y recomendaciones; nunca lo modifica.`}
      />
      <CopilotScope
        screen="Foxy Brand Brain"
        postId={null}
        platform={null}
        label={`${active.organization.name} · estrategia y memoria`}
        suggestions={[
          '¿Estamos cumpliendo nuestra estrategia?',
          ...BRAND_QUESTIONS.filter((q) => !/estrategia/.test(q)),
        ]}
        postHrefPattern={withPeriod('/publicaciones/{id}', period)}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
        {stored ? (
          <StatusPill tone="info" icon={History}>
            Versión {stored.version}
            {stored.updatedAt ? ` · ${fmtDateTime(stored.updatedAt)}` : ''}
            {nameOf(stored.updatedBy) ? ` · ${nameOf(stored.updatedBy)}` : ''}
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">Sin contexto guardado</StatusPill>
        )}
        {synthetic && (
          <StatusPill tone="warning">
            Organización sintética de prueba: no describe una marca real
          </StatusPill>
        )}
        {pendingMem.length > 0 && (
          <a
            href="#bb-mem"
            className="text-primary-text text-xs font-extrabold"
          >
            {pendingMem.length}{' '}
            {pendingMem.length === 1
              ? 'aprendizaje pendiente'
              : 'aprendizajes pendientes'}{' '}
            de revisión
          </a>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <BrandContextCard
            stored={stored}
            href="#identidad"
            availability={availability}
            learnings={{
              proposed: pendingMem.length,
              validated: memory.filter((m) => m.status === 'validated').length,
            }}
          />
          <Panel aria-labelledby="bb-why">
            <PanelHeader
              icon={Sparkles}
              title="Cómo lo usa Foxy"
              titleId="bb-why"
            />
            <ul className="text-muted-foreground space-y-1.5 text-[13px]">
              <li>· Reconoce el pilar y la campaña de cada publicación.</li>
              <li>
                · Relaciona el objetivo probable con los objetivos registrados.
              </li>
              <li>· Personaliza hooks, CTA y propuestas creativas.</li>
              <li>
                · Sin contexto, lo dice: no inventa pilares, campañas ni
                objetivos.
              </li>
            </ul>
          </Panel>
          <Panel aria-labelledby="bb-docs">
            <PanelHeader
              icon={Library}
              tone="neutral"
              title="Base de conocimiento"
              titleId="bb-docs"
              description="Próxima etapa"
            />
            <p className="text-muted-foreground text-[13px]">
              Biblioteca documental (PDF, briefs, manuales, estudios) con
              versiones, fechas y fuentes, y búsqueda semántica. Requiere
              autorización: no se cargan documentos reales ni se envían a
              proveedores externos.
            </p>
          </Panel>
        </aside>

        <div className="min-w-0 space-y-4 lg:col-span-8">
          {availability === 'needs_migration' && (
            <EmptyStateV2 title="Foxy Brand Brain está pendiente de activación">
              Requiere la migración 0007 en esta base (preparada y probada en
              local; pendiente de GO). Mientras tanto, Foxy analiza sin contexto
              estratégico y lo indica.
            </EmptyStateV2>
          )}
          {ro && availability === 'ready' && (
            <p className="text-muted-foreground text-sm">
              Vista de solo lectura: tu rol ({active.role}) no edita el contexto
              estratégico.
            </p>
          )}
          {!stored && availability === 'ready' && (
            <Panel aria-labelledby="bb-start">
              <PanelHeader
                icon={CheckCircle2}
                tone="ai"
                title="Empieza por lo esencial"
                titleId="bb-start"
                description="Con estos campos Foxy ya puede reconocer pilares y evaluar la alineación."
              />
              <ol className="grid gap-2 text-[13px] sm:grid-cols-2">
                {comp.missing.map((m, i) => (
                  <li
                    key={m}
                    className="bg-muted/60 flex items-center gap-2 rounded-xl px-3 py-2"
                  >
                    <span className="bg-ai-bg text-ai-fg flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black">
                      {i + 1}
                    </span>
                    {m}
                  </li>
                ))}
              </ol>
              <p className="text-muted-foreground mt-3 text-xs">
                Solo información estratégica autorizada. No cargues datos de
                pacientes, credenciales ni documentos completos.
              </p>
            </Panel>
          )}
          <BrandBrainForm canEdit={canEdit}>
            <div id="identidad" className="scroll-mt-24">
              <Section icon={BookOpen} title="A. Identidad de marca" id="bb-a">
                <Field
                  name="name"
                  label="Nombre"
                  value={c.identity.name}
                  disabled={ro}
                />
                <Field
                  name="industry"
                  label="Industria"
                  value={c.identity.industry}
                  disabled={ro}
                />
                <Field
                  name="description"
                  label="Descripción"
                  value={c.identity.description}
                  rows={3}
                  disabled={ro}
                />
                <Field
                  name="valueProposition"
                  label="Propuesta de valor"
                  value={c.identity.valueProposition}
                  rows={3}
                  disabled={ro}
                />
                <Field
                  name="positioning"
                  label="Posicionamiento"
                  value={c.identity.positioning}
                  rows={2}
                  disabled={ro}
                />
                <Field
                  name="personality"
                  label="Personalidad"
                  value={c.identity.personality}
                  rows={2}
                  disabled={ro}
                />
                <Field
                  name="tone"
                  label="Tono de comunicación"
                  value={c.identity.tone}
                  rows={2}
                  disabled={ro}
                />
                <Field
                  name="visualGuidelines"
                  label="Lineamientos visuales"
                  value={c.identity.visualGuidelines}
                  rows={2}
                  disabled={ro}
                />
                <Field
                  name="brandManualRef"
                  label="Manual de marca (referencia)"
                  hint="Nombre o ubicación del documento; no se carga el archivo."
                  value={c.identity.brandManualRef}
                  disabled={ro}
                />
              </Section>
            </div>
            <Section icon={Compass} title="B. Estrategia" id="bb-b">
              <Field
                name="marketing"
                label="Estrategia de marketing"
                value={c.strategy.marketing}
                rows={3}
                disabled={ro}
              />
              <Field
                name="communication"
                label="Estrategia de comunicación"
                value={c.strategy.communication}
                rows={3}
                disabled={ro}
              />
              <Field
                name="organic"
                label="Estrategia orgánica"
                value={c.strategy.organic}
                rows={3}
                disabled={ro}
              />
              <Field
                name="businessGoals"
                label="Objetivos de negocio"
                hint="Uno por línea."
                value={join(c.strategy.businessGoals)}
                rows={3}
                disabled={ro}
              />
              <Field
                name="communicationGoals"
                label="Objetivos de comunicación"
                hint="Uno por línea."
                value={join(c.strategy.communicationGoals)}
                rows={3}
                disabled={ro}
              />
              <Field
                name="pillars"
                label="Pilares de contenido"
                hint="Uno por línea: Nombre | descripción | palabras, clave"
                value={c.strategy.pillars
                  .map((p) =>
                    [p.name, p.description, p.keywords.join(', ')].join(' | '),
                  )
                  .join('\n')}
                rows={4}
                disabled={ro}
              />
              <Field
                name="audiences"
                label="Audiencias"
                hint="Una por línea."
                value={join(c.strategy.audiences)}
                rows={3}
                disabled={ro}
              />
              <Field
                name="consumerInsights"
                label="Insights del consumidor"
                hint="Uno por línea."
                value={join(c.strategy.consumerInsights)}
                rows={3}
                disabled={ro}
              />
              <Field
                name="kpis"
                label="Indicadores prioritarios"
                hint="Uno por línea."
                value={join(c.strategy.kpis)}
                rows={3}
                disabled={ro}
              />
              <Field
                name="competitors"
                label="Competidores"
                hint="Uno por línea."
                value={join(c.strategy.competitors)}
                rows={3}
                disabled={ro}
              />
            </Section>
            <Section icon={Megaphone} title="C. Campañas" id="bb-c">
              <div className="md:col-span-2">
                <Field
                  name="campaigns"
                  label="Campañas activas e históricas"
                  hint="Una por línea: Nombre | activa o pasada | concepto creativo | objetivos | mensajes principales"
                  value={c.campaigns
                    .map((x) =>
                      [
                        x.name,
                        x.status === 'past' ? 'pasada' : 'activa',
                        x.concept,
                        x.goals,
                        x.keyMessages,
                      ].join(' | '),
                    )
                    .join('\n')}
                  rows={4}
                  disabled={ro}
                />
              </div>
            </Section>
          </BrandBrainForm>

          <Panel aria-labelledby="bb-mem" id="bb-mem" className="scroll-mt-24">
            <PanelHeader
              icon={Brain}
              title="E. Memoria estratégica · revisión humana"
              titleId="bb-mem"
              description={
                canReview
                  ? 'Aprendizajes propuestos desde Foxy. Revisa la evidencia y decide: aprobar, rechazar (con motivo) o archivar. Foxy nunca modifica la estrategia.'
                  : 'Aprendizajes propuestos desde Foxy. Solo owner o admin pueden aprobarlos o rechazarlos.'
              }
            />
            {memory.length === 0 ? (
              <EmptyStateV2 compact title="Sin aprendizajes propuestos">
                Usa «Guardar como aprendizaje» en el análisis de una
                publicación: quedará aquí pendiente de revisión.
              </EmptyStateV2>
            ) : (
              <div className="space-y-5">
                <section aria-labelledby="bb-pending">
                  <h3
                    id="bb-pending"
                    className="text-muted-foreground mb-2 text-[11px] font-extrabold uppercase tracking-wider"
                  >
                    Pendientes de revisión ({pendingMem.length})
                  </h3>
                  {pendingMem.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No hay propuestas pendientes.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingMem.map((m) => (
                        <LearningReviewCard
                          key={m.id}
                          entry={m}
                          authorName={nameOf(m.createdBy)}
                          reviewerName={nameOf(m.reviewedBy)}
                          canReview={canReview}
                          reviewMode={reviewMode}
                          withPeriod={periodQ}
                        />
                      ))}
                    </div>
                  )}
                </section>
                {historyMem.length > 0 && (
                  <section aria-labelledby="bb-history">
                    <h3
                      id="bb-history"
                      className="text-muted-foreground mb-2 text-[11px] font-extrabold uppercase tracking-wider"
                    >
                      Historial de decisiones ({historyMem.length})
                    </h3>
                    <div className="space-y-3">
                      {historyMem.map((m) => (
                        <LearningReviewCard
                          key={m.id}
                          entry={m}
                          authorName={nameOf(m.createdBy)}
                          reviewerName={nameOf(m.reviewedBy)}
                          canReview={canReview}
                          reviewMode={reviewMode}
                          withPeriod={periodQ}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </ModuleSurface>
  );
}
