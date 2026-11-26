import {
  Brain,
  BookOpen,
  Compass,
  Library,
  Megaphone,
  Save,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandContextCard } from '@/components/ds/intel';
import { ModuleSurface, PageHeaderV2 } from '@/components/ds/layout';
import { Panel, PanelHeader, StatusPill } from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import {
  brainAvailability,
  getBrandContext,
  listMemory,
} from '@/lib/brain/store';
import { MEMORY_KIND_LABEL, emptyBrandContext } from '@/lib/brain/types';
import { fmtDateTime } from '@/lib/format';
import { saveBrandBrainAction } from './actions';

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
  const { active } = await requireContext();
  const orgId = active.organization.id;
  const availability = brainAvailability();
  const [stored, memory] = await Promise.all([
    getBrandContext(orgId),
    listMemory(orgId),
  ]);
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
      {sp.guardado && (
        <p
          role="status"
          className="bg-success-bg text-success-fg mb-4 rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Contexto guardado (versión {stored?.version ?? 1}).
        </p>
      )}
      {sp.error && (
        <p
          role="alert"
          className="bg-critical-bg text-critical-fg mb-4 rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          {sp.error === 'rol'
            ? 'Solo owner o admin pueden editar Brand Brain.'
            : 'Revisa los campos: hay valores fuera de los límites permitidos.'}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <BrandContextCard
            stored={stored}
            href="#identidad"
            availability={availability}
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
          {stored?.isSynthetic && (
            <StatusPill tone="warning">
              Contexto sintético de prueba: no describe una marca real
            </StatusPill>
          )}
          <form action={saveBrandBrainAction} className="space-y-4">
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
            {canEdit && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-brand text-brand-foreground inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold"
                >
                  <Save aria-hidden className="h-4 w-4" /> Guardar contexto
                </button>
              </div>
            )}
          </form>

          <Panel aria-labelledby="bb-mem">
            <PanelHeader
              icon={Brain}
              title="E. Memoria estratégica"
              titleId="bb-mem"
              description="Aprendizajes y decisiones propuestos desde Foxy. Quedan como propuesta hasta que owner o admin los validen."
            />
            {memory.length === 0 ? (
              <EmptyStateV2 compact title="Sin aprendizajes guardados">
                Usa «Guardar como aprendizaje» en el análisis de una
                publicación.
              </EmptyStateV2>
            ) : (
              <ul className="divide-border divide-y">
                {memory.map((m) => (
                  <li key={m.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone="ai">
                        {MEMORY_KIND_LABEL[m.kind]}
                      </StatusPill>
                      <StatusPill
                        tone={m.status === 'validated' ? 'success' : 'warning'}
                      >
                        {m.status === 'validated'
                          ? 'Validado'
                          : m.status === 'archived'
                            ? 'Archivado'
                            : 'Propuesto'}
                      </StatusPill>
                      {m.isSynthetic && (
                        <StatusPill tone="warning">Sintético</StatusPill>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {fmtDateTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold">{m.title}</p>
                    <p className="text-muted-foreground text-[13px]">
                      {m.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </ModuleSurface>
  );
}
