import 'server-only';
import {
  MetricoolConnector,
  type CallBudget,
} from '@/lib/connectors/metricool';
import { dataMode } from '@/lib/env';
import { runSync } from './engine';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
} from './fixtures';
import { MemorySyncStore } from './memory-store';
import { SupabaseSyncStore, metricoolPersistenceReady } from './supabase-store';
import {
  initialState,
  type CoverageCell,
  type SourceSyncState,
  type StoredPost,
  type SyncRun,
  type SyncStore,
} from './types';

/**
 * Servicio de la fuente Metricool para la interfaz y la tarea programada (solo servidor).
 *
 *  - Modo demo: SIMULACIÓN con el servidor Metricool sintético (lib/sync/fixtures.ts) y un
 *    almacén en memoria. Nada sale a la red. Etiquetado como simulación en la interfaz.
 *  - Modo Supabase: conexión real solo si están TODAS las condiciones (GO de 0006, conector
 *    habilitado, token cargado en el servidor). Si falta alguna, la interfaz lo explica y no
 *    se toca la red. El token se lee solo aquí y nunca se devuelve al navegador.
 */
export type PanelMode = 'simulation' | 'live' | 'not_ready';

export interface MetricoolPanel {
  mode: PanelMode;
  killSwitch: boolean;
  scheduleEnabled: boolean;
  credentialsConfigured: boolean;
  pending: string[];
  state: SourceSyncState;
  counts: { posts: number; comments: number; snapshots: number };
  coverage: CoverageCell[];
  runs: SyncRun[];
  /** Últimas publicaciones importadas (vista previa del tratamiento de medios). */
  recentPosts: StoredPost[];
}

export const killSwitchOn = () => process.env.HF_SYNC_KILL_SWITCH === 'on';
export const scheduleEnabled = () =>
  process.env.HF_SYNC_SCHEDULE_ENABLED === 'true';

const g = globalThis as unknown as { __hfSimStore?: MemorySyncStore };
function simStore() {
  return (g.__hfSimStore ??= new MemorySyncStore());
}

function liveCredentials() {
  return {
    token: process.env.HF_METRICOOL_TOKEN ?? null,
    userId: process.env.HF_METRICOOL_USER_ID ?? null,
  };
}

/** Condiciones pendientes para la conexión real (vacío = lista). */
export function livePending(): string[] {
  if (dataMode() === 'demo') return [];
  const p: string[] = [];
  if (!metricoolPersistenceReady())
    p.push(
      'GO 1: aplicar la migración 0006 en heyfoxy-qa y configurar la clave de servicio y el salt en el servidor',
    );
  if (process.env.HF_CONNECTOR_METRICOOL_ENABLED !== 'true')
    p.push('Habilitar el conector (HF_CONNECTOR_METRICOOL_ENABLED) con GO');
  const c = liveCredentials();
  if (!c.token || !c.userId)
    p.push(
      'GO 2: Álvaro carga el token y el userId de Metricool como variables cifradas del servidor',
    );
  return p;
}

export function panelMode(): PanelMode {
  if (dataMode() === 'demo') return 'simulation';
  return livePending().length ? 'not_ready' : 'live';
}

function store(): SyncStore | null {
  const m = panelMode();
  if (m === 'simulation') return simStore();
  if (m === 'live') return new SupabaseSyncStore();
  return null;
}

function connectorFor(blogId: string | null, budget?: CallBudget) {
  if (panelMode() === 'simulation') {
    return new MetricoolConnector({
      enabled: true,
      token: FIXTURE_TOKEN,
      userId: FIXTURE_USER,
      blogId: blogId ?? FIXTURE_BLOG,
      fetchImpl: fixtureFetch({ commentScopes: ['instagram'] }).impl,
      minIntervalMs: 0,
      retryBaseMs: 10,
      budget,
    });
  }
  const c = liveCredentials();
  return new MetricoolConnector({
    enabled: process.env.HF_CONNECTOR_METRICOOL_ENABLED === 'true',
    ...c,
    blogId,
    budget,
  });
}

export async function getPanel(orgId: string): Promise<MetricoolPanel> {
  const mode = panelMode();
  const s = store();
  const state = (s && (await s.load(orgId))) ?? initialState();
  return {
    mode,
    killSwitch: killSwitchOn(),
    scheduleEnabled: scheduleEnabled(),
    credentialsConfigured:
      mode === 'simulation'
        ? true
        : Boolean(liveCredentials().token && liveCredentials().userId),
    pending: livePending(),
    state,
    counts: s ? await s.counts(orgId) : { posts: 0, comments: 0, snapshots: 0 },
    coverage: s ? await s.coverage(orgId) : [],
    runs: s ? await s.runs(orgId, 8) : [],
    recentPosts: s
      ? (await s.posts(orgId))
          .sort(
            (a, b) =>
              Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''),
          )
          .slice(0, 6)
      : [],
  };
}

/** Valida credenciales y devuelve las marcas accesibles (sin leer contenido). */
export async function listBrands(): Promise<
  Array<{ blogId: string; label: string; networks: string[] }>
> {
  if (panelMode() === 'not_ready')
    throw new Error('Conexión real pendiente de autorizaciones');
  const brands = await connectorFor(null).listBrands();
  return brands.map((b) => ({
    blogId: b.blogId,
    label: b.label,
    networks: b.networks,
  }));
}

/** Conecta la organización a una marca de Metricool (validando que el token la ve). */
export async function connectBrand(orgId: string, blogId: string) {
  const s = store();
  if (!s) throw new Error('Conexión real pendiente de autorizaciones');
  const brand = (await connectorFor(null).listBrands()).find(
    (b) => b.blogId === blogId,
  );
  if (!brand)
    throw new Error(
      'La marca no es accesible con las credenciales configuradas',
    );
  await s.save(orgId, {
    status: 'connected',
    statusReason: null,
    paused: false,
    brand: {
      blogId: brand.blogId,
      label: brand.label,
      networks: brand.networks,
      tokenExpirations: brand.tokenExpirations,
    },
    cursor: {},
    consecutiveFailures: 0,
  });
}

export async function syncNow(
  orgId: string,
  trigger: 'manual' | 'scheduled' = 'manual',
) {
  const s = store();
  if (!s) throw new Error('Conexión real pendiente de autorizaciones');
  const st = await s.load(orgId);
  return runSync({
    orgId,
    store: s,
    trigger,
    killSwitch: killSwitchOn(),
    connector: (budget) => connectorFor(st?.brand?.blogId ?? null, budget),
    // Simulación: ventana amplia para que el servidor sintético siga dentro del periodo.
    initialDays: panelMode() === 'simulation' ? 120 : 30,
  });
}

export async function setPaused(orgId: string, paused: boolean) {
  const s = store();
  if (!s) throw new Error('Conexión real pendiente de autorizaciones');
  await s.save(orgId, { paused });
}

/** Desconecta: deja de sincronizar y olvida la marca. Lo importado se conserva (retención). */
export async function disconnect(orgId: string) {
  const s = store();
  if (!s) throw new Error('Conexión real pendiente de autorizaciones');
  await s.save(orgId, {
    status: 'disconnected',
    statusReason: 'Desconectada por la organización',
    brand: null,
    paused: true,
    cursor: {},
  });
}

/** Solo simulación: vuelve al estado inicial para repetir la demostración. */
export async function resetSimulation(orgId: string) {
  if (panelMode() === 'simulation') simStore().forget(orgId);
}
