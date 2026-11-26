import 'server-only';
import {
  MetricoolConnector,
  type CallBudget,
} from '@/lib/connectors/metricool';
import { dataMode } from '@/lib/env';
import type { Platform } from '@/lib/types';
import { runSync } from './engine';
import { PILOT_LIMITS } from './pilot';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
} from './fixtures';
import {
  parseAllowedBrands,
  serviceKeyKind,
  serviceKeyProblem,
} from './guards';
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
 *    habilitado, token cargado en el servidor, marca autorizada para la organización y
 *    organización NO demo). Si falta alguna, la interfaz lo explica y no se toca la red.
 *    El token se lee solo aquí y nunca se devuelve al navegador.
 *  - Marca autorizada: HF_METRICOOL_ALLOWED_BRANDS = "<orgId>:<blogId>". Otras marcas de la
 *    cuenta ni se listan ni se conectan ni se sincronizan (motor y conector lo comprueban).
 */
export type PanelMode = 'simulation' | 'live' | 'not_ready';

export interface MetricoolPanel {
  mode: PanelMode;
  killSwitch: boolean;
  scheduleEnabled: boolean;
  credentialsConfigured: boolean;
  pending: string[];
  state: SourceSyncState;
  counts: {
    posts: number;
    comments: number;
    snapshots: number;
    postsByPlatform?: Partial<Record<Platform, number>>;
  };
  coverage: CoverageCell[];
  runs: SyncRun[];
  /** Últimas publicaciones importadas (vista previa del tratamiento de medios). */
  recentPosts: StoredPost[];
  /** Verificaciones del servidor (modo real), sin valores secretos. */
  checks: Array<{ label: string; ok: boolean; detail: string }>;
}

/** Interruptor por variable de entorno (requiere redesplegar). El de la base es inmediato. */
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

function allowedBrands() {
  return parseAllowedBrands(process.env.HF_METRICOOL_ALLOWED_BRANDS);
}

/** Marcas autorizadas para una organización (simulación sin variable: sin restricción). */
export function allowedBlogIdsFor(orgId: string): string[] | undefined {
  const { byOrg } = allowedBrands();
  if (panelMode() === 'simulation' && byOrg.size === 0) return undefined;
  return [...(byOrg.get(orgId.toLowerCase()) ?? [])];
}

/** Condiciones pendientes para la conexión real (vacío = lista). */
export function livePending(): string[] {
  if (dataMode() === 'demo') return [];
  const p: string[] = [];
  if (process.env.HF_MIGRATION_0006_APPLIED !== 'true')
    p.push(
      'Migración 0006 aplicada en heyfoxy-qa (HF_MIGRATION_0006_APPLIED=true)',
    );
  const keyProblem = serviceKeyProblem(
    serviceKeyKind(process.env.HF_SUPABASE_SERVICE_ROLE_KEY),
  );
  if (keyProblem) p.push(keyProblem);
  if ((process.env.HF_AUTHOR_HASH_SALT ?? '').length < 32)
    p.push('HF_AUTHOR_HASH_SALT con al menos 32 caracteres aleatorios');
  if (!metricoolPersistenceReady() && !p.length)
    p.push('Persistencia de la sincronización no disponible');
  const allowed = allowedBrands();
  if (allowed.byOrg.size === 0)
    p.push(
      'HF_METRICOOL_ALLOWED_BRANDS con la organización y la marca autorizadas ("<orgId>:<blogId>")',
    );
  if (allowed.invalid > 0)
    p.push(
      `HF_METRICOOL_ALLOWED_BRANDS tiene ${allowed.invalid} entrada(s) mal formada(s)`,
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

function connectorFor(
  blogId: string | null,
  budget?: CallBudget,
  allowedBlogIds?: readonly string[],
) {
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
      allowedBlogIds,
    });
  }
  const c = liveCredentials();
  return new MetricoolConnector({
    enabled: process.env.HF_CONNECTOR_METRICOOL_ENABLED === 'true',
    ...c,
    blogId,
    budget,
    allowedBlogIds,
  });
}

/**
 * Motivo por el que esta organización no puede usar la conexión real (null = puede).
 * Falla cerrado: organización demo o sin marca autorizada => bloqueada.
 */
async function orgBlock(orgId: string, s: SyncStore): Promise<string | null> {
  if (panelMode() === 'simulation') return null;
  if (!s.isDemoOrg || (await s.isDemoOrg(orgId)))
    return 'Esta organización es de demostración: no admite datos reales de Metricool';
  if (!(allowedBlogIdsFor(orgId)?.length ?? 0))
    return 'Esta organización no tiene una marca de Metricool autorizada (HF_METRICOOL_ALLOWED_BRANDS)';
  return null;
}

class SyncBlockedError extends Error {
  constructor(readonly code: 'organizacion-demo' | 'marca-no-autorizada') {
    super(code);
  }
}

async function assertOrgAllowed(orgId: string, s: SyncStore) {
  const why = await orgBlock(orgId, s);
  if (!why) return;
  throw new SyncBlockedError(
    why.includes('demostración') ? 'organizacion-demo' : 'marca-no-autorizada',
  );
}

export function blockedCode(e: unknown): string | null {
  return e instanceof SyncBlockedError ? e.code : null;
}

/** Motivo de parada en caliente: interruptor (variable o base) o pausa de la organización. */
function stopCheck(orgId: string, s: SyncStore) {
  return async (): Promise<string | null> => {
    if (killSwitchOn()) return 'interruptor de emergencia (servidor)';
    if (s.globalKillSwitch && (await s.globalKillSwitch()))
      return 'interruptor de emergencia global (base de datos)';
    const st = await s.load(orgId);
    if (st?.paused) return 'pausada por la organización';
    if (st && st.status !== 'connected')
      return 'la fuente ya no está conectada';
    return null;
  };
}

export async function getPanel(orgId: string): Promise<MetricoolPanel> {
  const globalMode = panelMode();
  const s = store();
  const pending = livePending();
  const checks: MetricoolPanel['checks'] = [];
  let dbKill = false;
  if (s && globalMode === 'live') {
    if (s instanceof SupabaseSyncStore) {
      const v = await s.verifyServiceAccess();
      checks.push({ label: 'Clave de servicio de Supabase', ...v });
      if (!v.ok) pending.push(v.detail);
    }
    dbKill = s.globalKillSwitch ? await s.globalKillSwitch() : false;
    const block = await orgBlock(orgId, s);
    checks.push({
      label: 'Organización y marca autorizadas',
      ok: !block,
      detail:
        block ??
        `Solo la marca ${allowedBlogIdsFor(orgId)!.join(', ')} puede importarse aquí`,
    });
    if (block) pending.push(block);
    checks.push({
      label: 'Interruptor de emergencia',
      ok: !dbKill && !killSwitchOn(),
      detail:
        dbKill || killSwitchOn()
          ? 'ACTIVO: ninguna sincronización sale a la red'
          : 'Inactivo; se comprueba antes de cada llamada a Metricool',
    });
    checks.push({
      label: 'Límites del piloto',
      ok: !scheduleEnabled(),
      detail: scheduleEnabled()
        ? 'La sincronización automática está activada sin autorización'
        : `Solo manual · Instagram y Facebook · ${PILOT_LIMITS.maxPostsPerNetwork} publicaciones por red · cada sincronización refresca los últimos 30 días · comentarios desactivados por privacidad · medios por referencia (sin copia)`,
    });
  }
  const mode: PanelMode =
    globalMode === 'live' && pending.length ? 'not_ready' : globalMode;
  const loaded = s ? await s.load(orgId) : null;
  const state = loaded ?? initialState();
  const usable = Boolean(s && loaded);
  return {
    mode,
    checks,
    killSwitch: killSwitchOn() || dbKill,
    scheduleEnabled: scheduleEnabled(),
    credentialsConfigured:
      mode === 'simulation'
        ? true
        : Boolean(liveCredentials().token && liveCredentials().userId),
    pending,
    state,
    counts:
      usable && s
        ? await s.counts(orgId)
        : { posts: 0, comments: 0, snapshots: 0 },
    coverage: usable && s ? await s.coverage(orgId) : [],
    runs: usable && s ? await s.runs(orgId, 8) : [],
    recentPosts:
      usable && s
        ? (await s.posts(orgId))
            .sort(
              (a, b) =>
                Date.parse(b.publishedAt ?? '') -
                Date.parse(a.publishedAt ?? ''),
            )
            .slice(0, 6)
        : [],
  };
}

/**
 * Valida credenciales y devuelve SOLO las marcas autorizadas para la organización (sin leer
 * contenido). Las demás marcas de la cuenta no se muestran.
 */
export async function listBrands(
  orgId: string,
): Promise<Array<{ blogId: string; label: string; networks: string[] }>> {
  if (panelMode() === 'not_ready')
    throw new Error('Conexión real pendiente de autorizaciones');
  const s = store();
  if (!s) throw new Error('Conexión real pendiente de autorizaciones');
  await assertOrgAllowed(orgId, s);
  const allowed = allowedBlogIdsFor(orgId);
  const brands = (await connectorFor(null).listBrands()).filter(
    (b) => !allowed || allowed.includes(b.blogId),
  );
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
  await assertOrgAllowed(orgId, s);
  const allowed = allowedBlogIdsFor(orgId);
  if (allowed && !allowed.includes(blogId))
    throw new SyncBlockedError('marca-no-autorizada');
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
      pictureUrl: brand.pictureUrl,
      accounts: brand.accounts,
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
  await assertOrgAllowed(orgId, s);
  const st = await s.load(orgId);
  const allowed = allowedBlogIdsFor(orgId);
  return runSync({
    orgId,
    store: s,
    trigger,
    killSwitch: killSwitchOn(),
    stop: stopCheck(orgId, s),
    allowedBlogIds: allowed,
    connector: (budget) =>
      connectorFor(st?.brand?.blogId ?? null, budget, allowed),
    // Simulación: ventana amplia para que el servidor sintético siga dentro del periodo.
    initialDays: panelMode() === 'simulation' ? 120 : 30,
    // Piloto real (doc 20): 30 días, Instagram y Facebook, 10 publicaciones por red y datos
    // personales de comentarios enmascarados. La simulación conserva su comportamiento.
    ...(panelMode() === 'simulation' ? {} : PILOT_LIMITS),
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
