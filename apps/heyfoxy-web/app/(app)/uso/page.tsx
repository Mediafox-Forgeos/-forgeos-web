import { EngineBadge } from '@/components/ds/ai-engine';
import { Card, PageHeader, Stat } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { canConfigure } from '@/lib/incidents/fsm';
import { AI_TASK_LABEL } from '@/lib/intel/ai/budget';
import { MODEL_CATALOG } from '@/lib/intel/ai/catalog';
import { aiUsageSummary, publicAiStatus } from '@/lib/intel/ai/runtime';

export const metadata = { title: 'Uso y presupuestos' };

const usd = (n: number) =>
  `US$${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`;
const num = (n: number) => n.toLocaleString('es-CO');

export default async function UsagePage() {
  const { active, repo } = await requireContext();
  if (!canConfigure(active.role))
    return <p className="text-muted-foreground text-sm">Solo owner/admin.</p>;
  const orgId = active.organization.id;
  const [u, sources, ai] = await Promise.all([
    repo.usage(orgId),
    repo.sources(orgId),
    aiUsageSummary(orgId).catch(() => null),
  ]);
  const st = publicAiStatus(orgId);
  const pct = (a: number, b: number) =>
    b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
  const used = ai ? ai.monthSpentUsd + ai.reservedUsd : 0;
  return (
    <>
      <PageHeader
        layer="platform"
        title="Uso y presupuestos"
        description="Límites de IA, ingesta y WhatsApp por organización. Al agotarse el presupuesto de IA generativa, Foxy usa el motor local por reglas (costo cero) y lo indica en cada respuesta."
      />

      <section aria-labelledby="engine-title" className="mb-4 space-y-3">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="engine-title" className="text-base font-extrabold">
                Foxy Intelligence Engine
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {st.reason}
              </p>
            </div>
            <EngineBadge
              state={
                st.mode === 'generative'
                  ? 'available'
                  : st.mode === 'simulated'
                    ? 'simulated'
                    : 'local'
              }
              label={st.label}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Proveedor
              </dt>
              <dd className="font-mono">{st.provider}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Clave del proveedor
              </dt>
              <dd>
                {st.apiKeyConfigured
                  ? 'Configurada (valor oculto)'
                  : 'No configurada'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Datos reales autorizados
              </dt>
              <dd>
                {st.orgRealDataAuthorized
                  ? 'Sí, esta organización'
                  : 'No (solo datos sintéticos)'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Análisis de imágenes
              </dt>
              <dd>
                {st.orgMultimodalAuthorized
                  ? 'Autorizado'
                  : 'No autorizado para datos reales'}
              </dd>
            </div>
          </dl>
          <div
            className="focus-visible:ring-primary-text mt-4 overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2"
            tabIndex={0}
            role="region"
            aria-label="Modelos por tipo de tarea (desplazable)"
          >
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="text-muted-foreground mb-1 text-left text-xs font-bold">
                Modelos por tipo de tarea (configurables sin cambiar código)
              </caption>
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="py-1 font-bold">Tarea</th>
                  <th className="py-1 font-bold">Modelo</th>
                  <th className="py-1 font-bold">Entrada / salida por MTok</th>
                  <th className="py-1 font-bold">Verificación</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {st.models.map((m) => {
                  const info = MODEL_CATALOG[m.id];
                  return (
                    <tr key={m.tier}>
                      <td className="py-1.5">{m.tierLabel}</td>
                      <td className="py-1.5">
                        {m.label}{' '}
                        <span className="text-muted-foreground font-mono text-xs">
                          {m.id}
                        </span>
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {info
                          ? `US$${info.price.input} / US$${info.price.output}`
                          : '—'}
                      </td>
                      <td className="py-1.5 text-xs">
                        {m.verified
                          ? `Verificado ${info?.verifiedAt}${m.isDefault ? '' : ' · no recomendado por defecto'}`
                          : 'Sin verificar: bloqueado'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {st.issues.length > 0 && (
            <ul className="text-warning-fg mt-3 space-y-0.5 text-xs font-bold">
              {st.issues.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Límites: {usd(st.limits.orgMonthlyCapUsd)} al mes por organización
            (tope de plataforma) · pruebas sintéticas{' '}
            {usd(st.limits.syntheticCapUsd)} en total ·{' '}
            {st.limits.userDailyRequests} consultas generativas por usuario y
            día · {st.limits.orgConcurrency} generaciones simultáneas por
            organización.
          </p>
        </Card>

        {ai ? (
          <Card>
            <h2 className="text-base font-extrabold">
              Consumo de IA generativa este mes
            </h2>
            <div
              className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full"
              role="meter"
              aria-label="Presupuesto de IA usado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct(used, ai.limitUsd)}
            >
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${pct(used, ai.limitUsd)}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {usd(ai.monthSpentUsd)} gastado · {usd(ai.reservedUsd)} reservado
              en curso · límite {usd(ai.limitUsd)} ({pct(used, ai.limitUsd)} %)
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Solicitudes" value={num(ai.requests)} />
              <Stat
                label="Reutilizadas por caché"
                value={num(ai.cacheHits)}
                hint="Sin costo"
              />
              <Stat
                label="Respaldo local"
                value={num(ai.fallbacks)}
                hint="Motor por reglas"
              />
              <Stat label="Errores o cancelaciones" value={num(ai.errors)} />
              <Stat
                label="Tokens (entrada / salida)"
                value={`${num(ai.tokens.input + ai.tokens.cacheRead + ai.tokens.cacheWrite)} / ${num(ai.tokens.output)}`}
                hint={`${num(ai.tokens.cacheRead)} leídos de caché`}
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <table className="w-full text-left text-sm">
                <caption className="text-muted-foreground mb-1 text-left text-xs font-bold">
                  Por tipo de tarea
                </caption>
                <tbody className="divide-border divide-y">
                  {ai.byTask.length === 0 && (
                    <tr>
                      <td className="text-muted-foreground py-1.5">
                        Sin consumo este mes.
                      </td>
                    </tr>
                  )}
                  {ai.byTask.map((t) => (
                    <tr key={t.task}>
                      <td className="py-1.5">
                        {AI_TASK_LABEL[t.task] ?? t.task}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {num(t.requests)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {usd(t.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full text-left text-sm">
                <caption className="text-muted-foreground mb-1 text-left text-xs font-bold">
                  Por modelo
                </caption>
                <tbody className="divide-border divide-y">
                  {ai.byModel.length === 0 && (
                    <tr>
                      <td className="text-muted-foreground py-1.5">
                        Sin consumo este mes.
                      </td>
                    </tr>
                  )}
                  {ai.byModel.map((m) => (
                    <tr key={`${m.provider}|${m.model}`}>
                      <td className="py-1.5">
                        {MODEL_CATALOG[m.model]?.label ?? m.model}
                        {m.provider === 'fixture' && (
                          <span className="text-warning-fg ml-1 text-xs font-bold">
                            (simulación)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {num(m.requests)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {usd(m.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              El costo se calcula con las tarifas oficiales verificadas a partir
              de los tokens que informa el proveedor; antes de cada llamada se
              reserva el costo máximo previsible.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-muted-foreground text-sm">
              El registro detallado de IA generativa requiere la migración 0009
              (preparada en local, pendiente de GO).
            </p>
          </Card>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Clasificador de comentarios (USD)"
          value={`${u.aiMonthlyUsdSpent.toFixed(2)} / ${u.aiMonthlyUsdLimit}`}
          hint={`${pct(u.aiMonthlyUsdSpent, u.aiMonthlyUsdLimit)}% del límite`}
        />
        <Stat
          label="Items analizados hoy"
          value={`${u.aiDailyItemsUsed} / ${u.aiDailyItemsLimit}`}
        />
        <Stat
          label="Reutilizados por caché"
          value={u.cacheHits}
          hint="Duplicados sin costo"
        />
        <Stat
          label="WhatsApp (USD/mes)"
          value={`0.00 / ${u.whatsappMonthlyUsdLimit}`}
          hint="Simulación: sin costo"
        />
      </div>
      <Card className="mt-4">
        <p className="text-sm">
          Clasificador de comentarios (V1):{' '}
          <span className="font-mono">{u.provider}</span> · modelo{' '}
          <span className="font-mono">{u.model}</span>
        </p>
        <h2 className="mt-4 text-sm font-medium">
          Límites de ingesta por fuente
        </h2>
        <ul className="mt-2 divide-y text-sm">
          {sources.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>{s.displayName}</span>
              <span className="text-muted-foreground tabular-nums">
                {s.maxItemsPerDay.toLocaleString('es-CO')} items/día ·{' '}
                {s.ingestionPaused ? 'pausada' : 'activa'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
