import {
  Activity,
  BarChart3,
  CircleAlert,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Clock,
  Gauge,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Newspaper,
  OctagonX,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Unplug,
  type LucideIcon,
} from 'lucide-react';
import { ModuleSurface, PageHeaderV2 } from '@/components/ds/layout';
import { NetworkIcon } from '@/components/ds/network-icons';
import { SocialPostCard } from '@/components/ds/post';
import {
  IconBadge,
  Panel,
  PanelHeader,
  StatusPill,
  btn,
  type Tone,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { PROVIDER_CATALOG } from '@/lib/connectors/registry';
import { PLATFORM_LABEL, fmtDateTime, fmtRelative } from '@/lib/format';
import { postStats } from '@/lib/insights';
import { getPanel, listBrands } from '@/lib/sync/service';
import { storedToPost } from '@/lib/sync/to-post';
import type { CoverageCell, SyncRun } from '@/lib/sync/types';
import { getUiTheme } from '@/lib/shell';
import type { CoverageStatus, DataKind, Platform } from '@/lib/types';
import { isV2 } from '@/lib/ui-theme';
import {
  connectAction,
  disconnectAction,
  pauseAction,
  resetSimulationAction,
  syncAction,
} from './actions';
import { LegacyCoverage } from './legacy-coverage';

export const metadata = { title: 'Fuentes y cobertura' };

const KINDS: Array<{ kind: DataKind; label: string }> = [
  { kind: 'posts', label: 'Publicaciones' },
  { kind: 'post_metrics', label: 'Métricas' },
  { kind: 'comments', label: 'Comentarios y respuestas' },
  { kind: 'mentions', label: 'Menciones de terceros' },
];
const COVERAGE: Record<CoverageStatus, { label: string; tone: Tone }> = {
  complete: { label: 'Disponible', tone: 'success' },
  partial: { label: 'Parcial', tone: 'info' },
  not_permitted: { label: 'Sin permiso', tone: 'warning' },
  unavailable: { label: 'No disponible', tone: 'neutral' },
  not_requested: { label: 'No solicitado', tone: 'neutral' },
};
const RUN: Record<SyncRun['status'], { label: string; tone: Tone }> = {
  succeeded: { label: 'Correcta', tone: 'success' },
  partial: { label: 'Parcial', tone: 'warning' },
  failed: { label: 'Fallida', tone: 'critical' },
  skipped_paused: { label: 'Omitida: pausada', tone: 'neutral' },
  skipped_kill_switch: { label: 'Omitida: emergencia', tone: 'critical' },
  skipped_budget: { label: 'Omitida: límite de API', tone: 'warning' },
  skipped_not_connected: { label: 'Omitida: sin conexión', tone: 'neutral' },
};
const NOTICE: Record<string, { tone: Tone; text: string }> = {
  'sync-succeeded': { tone: 'success', text: 'Sincronización completada.' },
  'sync-partial': {
    tone: 'warning',
    text: 'Sincronización parcial: revisa los errores por red.',
  },
  'sync-failed': {
    tone: 'critical',
    text: 'La sincronización falló: revisa el estado de la conexión.',
  },
  'sync-skipped_paused': {
    tone: 'neutral',
    text: 'La fuente está pausada: reanúdala para sincronizar.',
  },
  'sync-skipped_kill_switch': {
    tone: 'critical',
    text: 'Interruptor de emergencia activo: no se sincronizó.',
  },
  'sync-skipped_budget': {
    tone: 'warning',
    text: 'Límite diario de llamadas a la API alcanzado.',
  },
  'sync-skipped_not_connected': {
    tone: 'neutral',
    text: 'Conecta primero una marca de Metricool.',
  },
  'sync-error': { tone: 'critical', text: 'No se pudo sincronizar.' },
  pausada: {
    tone: 'neutral',
    text: 'Sincronización pausada para esta organización.',
  },
  reanudada: { tone: 'success', text: 'Sincronización reanudada.' },
  desconectada: {
    tone: 'neutral',
    text: 'Metricool desconectado. Lo importado se conserva según la retención.',
  },
  'desconexion-sin-confirmar': {
    tone: 'warning',
    text: 'Para desconectar escribe DESCONECTAR.',
  },
  conectada: {
    tone: 'success',
    text: 'Marca conectada. Ya puedes sincronizar.',
  },
  'conexion-error': {
    tone: 'critical',
    text: 'No se pudo conectar la marca con las credenciales configuradas.',
  },
  'marca-invalida': { tone: 'warning', text: 'Marca no válida.' },
  'sin-permiso': {
    tone: 'warning',
    text: 'Solo owner y admin pueden gestionar las fuentes.',
  },
  'simulacion-reiniciada': { tone: 'neutral', text: 'Simulación reiniciada.' },
};

function Stat({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-border/80 bg-card rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <IconBadge icon={icon} tone={tone} size="sm" />
        <p className="text-[13px] font-extrabold leading-tight">{label}</p>
      </div>
      <p className="mt-2 text-[22px] font-black tabular-nums leading-none">
        {value}
      </p>
      {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
    </div>
  );
}

/** Fuentes y cobertura V2 (WO-HF-METRICOOL-INTEGRATION-001, fase E). */
export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isV2(await getUiTheme())) return <LegacyCoverage />;
  const sp = await searchParams;
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const canManage = ['owner', 'admin'].includes(active.role);
  const [panel, sources] = await Promise.all([
    getPanel(orgId),
    repo.sources(orgId),
  ]);
  const st = panel.state;
  const connected = st.status === 'connected' && st.brand;
  let brands: Awaited<ReturnType<typeof listBrands>> = [];
  let brandError: string | null = null;
  if (!connected && panel.mode !== 'not_ready' && canManage) {
    try {
      brands = await listBrands();
    } catch {
      brandError = 'Las credenciales configuradas no son válidas o caducaron.';
    }
  }
  const notice = sp.aviso ? NOTICE[sp.aviso] : undefined;
  const statusPill: { tone: Tone; label: string; icon: LucideIcon } =
    panel.killSwitch
      ? { tone: 'critical', label: 'Detenida (emergencia)', icon: OctagonX }
      : st.status === 'connected' && st.paused
        ? { tone: 'neutral', label: 'Pausada', icon: CirclePause }
        : st.status === 'connected'
          ? { tone: 'success', label: 'Conectada', icon: CircleCheck }
          : st.status === 'error'
            ? {
                tone: 'critical',
                label: 'Error de conexión',
                icon: CircleAlert,
              }
            : {
                tone: 'neutral',
                label:
                  st.status === 'disconnected'
                    ? 'Desconectada'
                    : 'No conectada',
                icon: Unplug,
              };
  const covBy = new Map(
    panel.coverage.map((c) => [`${c.platform}:${c.dataKind}`, c]),
  );
  const networks: Platform[] = st.brand?.networks ?? [];
  const lastRun = panel.runs[0];

  return (
    <ModuleSurface module="explorer">
      <PageHeaderV2
        icon={PlugZap}
        tone="info"
        eyebrow="Escucha operativa"
        title="Fuentes y cobertura"
        description="Qué fuentes alimentan Hey Foxy, qué datos entregan por red y qué NO se está escuchando. Las fuentes son de solo lectura: Hey Foxy no publica, borra ni responde en las redes."
      />

      {panel.killSwitch && (
        <div
          role="alert"
          className="border-critical-border bg-critical-soft rounded-card mb-4 flex gap-2.5 border p-3.5 text-sm"
        >
          <OctagonX
            aria-hidden
            className="text-critical-fg mt-0.5 h-5 w-5 shrink-0"
          />
          <p>
            <b>Interruptor de emergencia activo.</b> Ninguna organización
            sincroniza hasta que se desactive en el servidor.
          </p>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-4">
          <StatusPill tone={notice.tone}>{notice.text}</StatusPill>
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-12">
        {/* Tarjeta de conexión */}
        <Panel className="xl:col-span-7" aria-labelledby="mc-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-primary-pale text-primary-text flex h-12 w-12 items-center justify-center rounded-2xl"
              >
                <BarChart3 className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <h2 id="mc-title" className="text-lg font-black leading-tight">
                  Metricool
                </h2>
                <p className="text-muted-foreground text-[13px]">
                  Plan Advanced · publicaciones, métricas y comentarios de
                  cuentas propias
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusPill tone={statusPill.tone} icon={statusPill.icon}>
                {statusPill.label}
              </StatusPill>
              {panel.mode === 'simulation' && (
                <StatusPill tone="warning">
                  Simulación · datos sintéticos
                </StatusPill>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Marca seleccionada
              </dt>
              <dd className="font-extrabold">{st.brand?.label ?? 'Ninguna'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Credenciales
              </dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <KeyRound aria-hidden className="h-4 w-4" />
                {panel.mode === 'simulation'
                  ? 'Simuladas (no hay token real)'
                  : panel.credentialsConfigured
                    ? 'Configuradas en el servidor · no visibles'
                    : 'No configuradas'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Última sincronización
              </dt>
              <dd className="font-semibold">
                {st.lastSyncFinishedAt ? (
                  <>
                    {fmtRelative(st.lastSyncFinishedAt)}{' '}
                    {st.lastSyncStatus && (
                      <StatusPill tone={RUN[st.lastSyncStatus].tone}>
                        {RUN[st.lastSyncStatus].label}
                      </StatusPill>
                    )}
                  </>
                ) : (
                  'Nunca'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold">
                Sincronización programada
              </dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <Clock aria-hidden className="h-4 w-4" />
                {panel.scheduleEnabled
                  ? 'Activa (cada 30 min)'
                  : 'Preparada · desactivada'}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-muted-foreground mb-1.5 text-xs font-bold">
              Redes disponibles en la marca
            </p>
            {networks.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {networks.map((p) => (
                  <li
                    key={p}
                    className="border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-bold"
                  >
                    <NetworkIcon platform={p} size={16} /> {PLATFORM_LABEL[p]}
                    {st.brand?.tokenExpirations[p] && (
                      <span className="text-muted-foreground font-semibold">
                        · token hasta{' '}
                        {fmtDateTime(st.brand.tokenExpirations[p]!)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin marca conectada.
              </p>
            )}
          </div>

          {(st.statusReason || st.lastSyncError) && (
            <p className="border-critical-border bg-critical-soft mt-4 flex gap-2 rounded-xl border p-3 text-sm">
              <CircleAlert
                aria-hidden
                className="text-critical-fg mt-0.5 h-4 w-4 shrink-0"
              />
              <span>{st.statusReason ?? st.lastSyncError}</span>
            </p>
          )}

          {/* Acciones */}
          {canManage && panel.mode !== 'not_ready' && (
            <div className="border-border mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
              {connected ? (
                <>
                  <form action={syncAction}>
                    <button
                      className={btn.primary}
                      disabled={panel.killSwitch || st.paused}
                    >
                      <RefreshCw aria-hidden className="h-4 w-4" /> Sincronizar
                      ahora
                    </button>
                  </form>
                  <form action={pauseAction}>
                    <input
                      type="hidden"
                      name="paused"
                      value={String(!st.paused)}
                    />
                    <button className={btn.secondary}>
                      {st.paused ? (
                        <CirclePlay aria-hidden className="h-4 w-4" />
                      ) : (
                        <CirclePause aria-hidden className="h-4 w-4" />
                      )}
                      {st.paused ? 'Reanudar' : 'Pausar'}
                    </button>
                  </form>
                  <details className="group">
                    <summary
                      className={`${btn.ghost} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                    >
                      <Unplug aria-hidden className="h-4 w-4" /> Desconectar
                    </summary>
                    <form
                      action={disconnectAction}
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <label htmlFor="confirm-dc" className="text-xs font-bold">
                        Escribe DESCONECTAR para confirmar
                      </label>
                      <input
                        id="confirm-dc"
                        name="confirm"
                        autoComplete="off"
                        className="border-border bg-card rounded-lg border px-2 py-1 text-sm"
                      />
                      <button className={btn.danger}>
                        Confirmar desconexión
                      </button>
                    </form>
                  </details>
                </>
              ) : brandError ? (
                <p className="text-critical-fg text-sm font-bold">
                  {brandError}
                </p>
              ) : (
                <form
                  action={connectAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <label htmlFor="blog" className="text-sm font-bold">
                    Marca de Metricool
                  </label>
                  <select
                    id="blog"
                    name="blogId"
                    className="border-border bg-card rounded-xl border px-3 py-2 text-sm font-semibold"
                  >
                    {brands.map((b) => (
                      <option key={b.blogId} value={b.blogId}>
                        {b.label} · {b.networks.length} redes
                      </option>
                    ))}
                  </select>
                  <button className={btn.primary}>
                    <PlugZap aria-hidden className="h-4 w-4" /> Conectar marca
                  </button>
                </form>
              )}
              {panel.mode === 'simulation' && (
                <form action={resetSimulationAction} className="ml-auto">
                  <button className={btn.ghost}>Reiniciar simulación</button>
                </form>
              )}
            </div>
          )}
          {!canManage && (
            <p className="text-muted-foreground mt-4 text-xs">
              Solo owner y admin pueden sincronizar, pausar o desconectar.
            </p>
          )}
        </Panel>

        {/* Consumo e importación */}
        <div className="grid grid-cols-2 gap-3 xl:col-span-5">
          <Stat
            icon={Newspaper}
            tone="info"
            label="Publicaciones importadas"
            value={panel.counts.posts.toLocaleString('es-CO')}
            sub={
              lastRun
                ? `+${lastRun.postsInserted} nuevas en la última`
                : undefined
            }
          />
          <Stat
            icon={MessagesSquare}
            tone="ai"
            label="Comentarios importados"
            value={panel.counts.comments.toLocaleString('es-CO')}
            sub={
              lastRun
                ? `+${lastRun.commentsInserted} nuevos · ${lastRun.duplicates} duplicados`
                : undefined
            }
          />
          <Stat
            icon={Gauge}
            tone="high"
            label="Llamadas a la API hoy"
            value={`${st.apiCallsToday} / ${st.maxApiCallsPerDay}`}
            sub="Límite propio (Metricool no publica límites)"
          />
          <Stat
            icon={Activity}
            tone="success"
            label="Elementos importados hoy"
            value={`${st.itemsToday} / ${st.maxItemsPerDay}`}
            sub="Tope diario por organización"
          />
        </div>
      </div>

      {panel.mode === 'not_ready' && (
        <Panel className="mt-4" aria-labelledby="pend-title">
          <PanelHeader
            icon={ListChecks}
            tone="warning"
            title="Pendiente para conectar la cuenta real"
            titleId="pend-title"
            description="La conexión real no se activa hasta completar cada paso con su GO."
          />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {panel.pending.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </Panel>
      )}

      {/* Matriz de cobertura */}
      <Panel className="mt-4" aria-labelledby="cov-title">
        <PanelHeader
          icon={ShieldCheck}
          tone="success"
          title="Cobertura por red y tipo de dato"
          titleId="cov-title"
          description="Resultado de la última sincronización: qué se recibe, qué es parcial y qué no está disponible, con el motivo."
        />
        {networks.length === 0 ? (
          <EmptyStateV2 compact title="Sin cobertura de Metricool">
            Conecta una marca para ver qué datos entrega cada red.
          </EmptyStateV2>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Matriz de cobertura"
          >
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">
                Cobertura de Metricool por red y tipo de dato
              </caption>
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th scope="col" className="py-2 pr-3">
                    Red
                  </th>
                  {KINDS.map((k) => (
                    <th key={k.kind} scope="col" className="px-2 py-2">
                      {k.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {networks.map((p) => (
                  <tr key={p} className="align-top">
                    <th scope="row" className="py-3 pr-3 text-left">
                      <span className="inline-flex items-center gap-2 font-extrabold">
                        <NetworkIcon platform={p} size={20} />{' '}
                        {PLATFORM_LABEL[p]}
                      </span>
                    </th>
                    {KINDS.map((k) => {
                      const c: CoverageCell | undefined = covBy.get(
                        `${p}:${k.kind}`,
                      );
                      return (
                        <td key={k.kind} className="px-2 py-3">
                          {c ? (
                            <>
                              <StatusPill tone={COVERAGE[c.status].tone}>
                                {COVERAGE[c.status].label}
                                {c.items ? ` · ${c.items}` : ''}
                              </StatusPill>
                              <p className="text-muted-foreground mt-1 max-w-[14rem] text-xs leading-snug">
                                {c.reason}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Sin sincronizar
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Vista previa de lo importado: tratamiento de medios (fase D) */}
      {panel.recentPosts.length > 0 && (
        <Panel className="mt-4" aria-labelledby="imp-title">
          <PanelHeader
            icon={Newspaper}
            tone="info"
            title="Publicaciones importadas"
            titleId="imp-title"
            description="Medios por referencia a la red: solo lo que la fuente entrega. Si una URL caduca se indica; nunca se inventa una imagen."
          />
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {panel.recentPosts.map((sp) => {
              const post = {
                ...storedToPost(orgId, sp, st.brand?.label ?? null),
                isSynthetic: panel.mode === 'simulation',
              };
              const n = sp.media?.length ?? 0;
              const info =
                sp.contentType === 'carousel'
                  ? `Carrusel · ${n} ${n === 1 ? 'medio entregado' : 'medios entregados'} por la fuente`
                  : sp.contentType === 'reel' || sp.contentType === 'video'
                    ? 'Video · la fuente solo entrega la miniatura'
                    : n
                      ? 'Imagen por referencia'
                      : 'La fuente no entregó imagen';
              return (
                <li key={post.id} className="flex flex-col gap-1.5">
                  <p className="text-muted-foreground px-1 text-xs font-semibold">
                    {info}
                  </p>
                  <SocialPostCard
                    post={post}
                    stats={postStats(post)}
                    comments={0}
                    dominant={null}
                    href={post.permalink ?? '/cobertura'}
                  />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Registro de ejecuciones y errores */}
      <Panel className="mt-4" aria-labelledby="runs-title">
        <PanelHeader
          icon={Activity}
          tone="info"
          title="Registro de sincronizaciones y errores"
          titleId="runs-title"
          description="Últimas ejecuciones con reintentos, duplicados descartados y consumo de API. Los errores no incluyen credenciales."
        />
        {panel.runs.length === 0 ? (
          <EmptyStateV2 compact title="Aún no hay sincronizaciones" />
        ) : (
          <ul className="divide-border divide-y">
            {panel.runs.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill tone={RUN[r.status].tone}>
                    {RUN[r.status].label}
                  </StatusPill>
                  <span className="font-bold">{fmtDateTime(r.finishedAt)}</span>
                  <span className="text-muted-foreground text-xs">
                    {r.trigger === 'manual' ? 'Manual' : 'Programada'} ·{' '}
                    {r.postsInserted} publicaciones nuevas · {r.postsUpdated}{' '}
                    actualizadas · {r.commentsInserted} comentarios ·{' '}
                    {r.duplicates} duplicados · {r.apiCalls} llamadas
                  </span>
                </div>
                {r.errors.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {r.errors.map((e, i) => (
                      <li
                        key={i}
                        className="text-muted-foreground flex gap-1.5 text-xs"
                      >
                        <CircleAlert
                          aria-hidden
                          className="mt-px h-3.5 w-3.5 shrink-0"
                        />
                        <span>
                          {e.platform ? `${PLATFORM_LABEL[e.platform]} · ` : ''}
                          {e.message}
                          {e.retryable
                            ? ' · se reintentará en la próxima ejecución'
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Otras fuentes de la organización */}
      <Panel className="mt-4" aria-labelledby="src-title">
        <PanelHeader
          icon={PlugZap}
          tone="neutral"
          title="Otras fuentes de la organización"
          titleId="src-title"
        />
        <ul className="divide-border divide-y text-sm">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="font-extrabold">
                {PROVIDER_CATALOG[s.provider].label}
              </span>
              <span className="text-muted-foreground text-xs">
                {PROVIDER_CATALOG[s.provider].note}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </ModuleSurface>
  );
}
