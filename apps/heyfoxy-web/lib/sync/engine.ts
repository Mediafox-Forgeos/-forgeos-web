import {
  MetricoolError,
  POSTS_SUPPORTED,
  POSTS_UNSUPPORTED_REASON,
  flattenThreads,
  threadPostMedia,
  type CallBudget,
  type MetricoolConnector,
} from '@/lib/connectors/metricool';
import { planIngestion } from '@/lib/ingestion/pipeline';
import { PLATFORM_LABEL } from '@/lib/format';
import type { Platform } from '@/lib/types';
import { protectComment } from './privacy';
import type {
  CoverageCell,
  SourceSyncState,
  SyncError,
  SyncRun,
  SyncRunStatus,
  SyncStore,
} from './types';
import { SyncPersistenceError } from './types';

/**
 * Motor de sincronización Metricool → Hey Foxy (solo lectura en la fuente).
 *
 * Reglas:
 *  - Interruptor de emergencia y pausa por organización se comprueban ANTES de tocar la red y
 *    otra vez antes de CADA llamada (por red y por página): activarlos detiene una ejecución en
 *    curso, que termina como «detenida» sin escribir nada más.
 *  - Solo se sincroniza la marca autorizada para la organización (`allowedBlogIds`).
 *  - Presupuesto diario de llamadas a la API y de elementos importados (requisito I).
 *  - Incremental: publicaciones desde el fin de la última ventana con éxito (con 48 h de
 *    solape para refrescar métricas); comentarios desde el más reciente importado (1 h de solape).
 *  - Deduplicación por id externo y por autor + hash de contenido.
 *  - Errores por red no detienen las demás (resultado «parcial»); credenciales inválidas sí.
 *  - La cobertura se recalcula en cada ejecución: qué hay, qué no y por qué.
 */
export interface SyncDeps {
  orgId: string;
  store: SyncStore;
  /** Fábrica del conector con el presupuesto de llamadas de esta ejecución. */
  connector: (budget: CallBudget) => MetricoolConnector;
  now?: Date;
  trigger?: 'manual' | 'scheduled';
  killSwitch?: boolean;
  /**
   * Comprobación de parada (interruptor global en la base, pausa de la organización…).
   * Devuelve el motivo para detener o null. Se consulta antes de cada llamada a la fuente.
   */
  stop?: () => Promise<string | null>;
  /** Marcas autorizadas para esta organización; si se indica, otra marca no se sincroniza. */
  allowedBlogIds?: readonly string[];
  timezone?: string;
  initialDays?: number;
  maxCommentPages?: number;
  /**
   * Piloto: máximo de publicaciones por red y ejecución (las más recientes de la ventana).
   * Los comentarios solo se importan de esas publicaciones.
   */
  maxPostsPerNetwork?: number;
  /** Piloto: redes que pueden sincronizarse (las demás de la marca se ignoran sin llamadas). */
  networks?: readonly Platform[];
  /**
   * Piloto: cada ejecución vuelve a pedir la ventana completa (`initialDays`) en lugar de
   * solo lo nuevo desde la última; así se renuevan métricas y URLs de medios (caducan) de
   * todas las publicaciones recuperadas (HF-MC-03). Las llamadas son las mismas.
   */
  refreshFullWindow?: boolean;
  /**
   * Piloto: al empezar, vuelve a leer la marca autorizada (1 llamada) para guardar su nombre,
   * imagen y cuentas por red (identidad de las publicaciones propias).
   */
  refreshBrandIdentity?: boolean;
  /** false: no se leen ni guardan comentarios (política de privacidad del piloto). */
  importComments?: boolean;
  /** Enmascara datos personales de comentarios de terceros antes de persistir (privacy.ts). */
  protectPersonalData?: boolean;
  newId?: () => string;
}

const DAY = 86_400_000;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export async function runSync(deps: SyncDeps): Promise<SyncRun> {
  const now = deps.now ?? new Date();
  const at = now.toISOString();
  const trigger = deps.trigger ?? 'manual';
  const id =
    deps.newId?.() ??
    `run-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const base: Omit<SyncRun, 'status' | 'finishedAt'> = {
    id,
    trigger,
    startedAt: at,
    postsInserted: 0,
    postsUpdated: 0,
    snapshots: 0,
    commentsInserted: 0,
    duplicates: 0,
    overLimit: 0,
    apiCalls: 0,
    errors: [],
  };
  const finish = async (
    status: SyncRunStatus,
    run: Omit<SyncRun, 'status' | 'finishedAt'> = base,
    statePatch: Partial<SourceSyncState> = {},
  ) => {
    const r: SyncRun = {
      ...run,
      status,
      finishedAt: (deps.now ?? new Date()).toISOString(),
    };
    await deps.store.recordRun(deps.orgId, r);
    const firstError = r.errors[0]?.message ?? null;
    await deps.store.save(deps.orgId, {
      lastSyncStartedAt: at,
      lastSyncFinishedAt: r.finishedAt,
      lastSyncStatus: status,
      lastSyncError: status === 'succeeded' ? null : firstError,
      ...statePatch,
    });
    return r;
  };

  const stopReason = async () => (deps.stop ? deps.stop() : null);
  const killed = deps.killSwitch
    ? 'Interruptor de emergencia activo: sincronización detenida para todas las organizaciones'
    : await stopReason();
  if (killed) {
    return finish('skipped_kill_switch', { ...base, errors: [skip(killed)] });
  }
  const state = await deps.store.load(deps.orgId);
  if (!state || state.status !== 'connected' || !state.brand) {
    return finish('skipped_not_connected', {
      ...base,
      errors: [skip('La fuente no está conectada a una marca de Metricool')],
    });
  }
  if (
    deps.allowedBlogIds &&
    !deps.allowedBlogIds.includes(state.brand.blogId)
  ) {
    return finish(
      'skipped_not_authorized',
      {
        ...base,
        errors: [
          skip(
            'La marca conectada no está autorizada para esta organización: no se importa nada',
          ),
        ],
      },
      {
        status: 'error',
        statusReason: 'Marca no autorizada para esta organización',
      },
    );
  }
  if (state.paused) {
    return finish('skipped_paused', {
      ...base,
      errors: [skip('Sincronización pausada por la organización')],
    });
  }

  const today = dayOf(now);
  const callsToday = state.apiCallsDate === today ? state.apiCallsToday : 0;
  const itemsToday = state.itemsDate === today ? state.itemsToday : 0;
  const budget: CallBudget = {
    remaining: Math.max(0, state.maxApiCallsPerDay - callsToday),
    used: 0,
  };
  if (budget.remaining <= 0) {
    return finish('skipped_budget', {
      ...base,
      errors: [
        skip(
          `Límite diario de ${state.maxApiCallsPerDay} llamadas a la API alcanzado`,
        ),
      ],
    });
  }

  const mc = deps.connector(budget);
  const run = { ...base, errors: [] as SyncError[] };
  const cells: CoverageCell[] = [];
  const cursor = structuredClone(state.cursor);
  cursor.postsTo ??= {};
  cursor.commentsSince ??= {};
  let itemsUsed = itemsToday;
  let authFailure: MetricoolError | null = null;
  let stopped: string | null = null;
  const initialFrom = new Date(now.getTime() - (deps.initialDays ?? 30) * DAY);

  const networksToSync = state.brand.networks.filter(
    (n) => !deps.networks || deps.networks.includes(n),
  );
  if (deps.refreshBrandIdentity) {
    try {
      const b = (await mc.listBrands()).find(
        (x) => x.blogId === state.brand!.blogId,
      );
      if (b) {
        const brand = {
          ...state.brand,
          label: b.label,
          pictureUrl: b.pictureUrl,
          accounts: b.accounts,
        };
        await deps.store.save(deps.orgId, { brand });
        state.brand = brand;
      }
    } catch (e) {
      const err = asMcError(e);
      if (err.kind === 'auth') authFailure = err;
      // Otros errores: la identidad queda como estaba; no detiene la sincronización.
    }
  }

  // Permisos de comentarios por red (sin leer contenido).
  let auths: Awaited<ReturnType<MetricoolConnector['checkAuthorizations']>> =
    [];
  try {
    if (deps.importComments !== false)
      auths = await mc.checkAuthorizations(networksToSync);
  } catch (e) {
    authFailure = asMcError(e);
  }

  const cap = deps.maxPostsPerNetwork;
  let redactions = 0;
  let healthWithheld = 0;

  networks: for (const platform of authFailure ? [] : networksToSync) {
    const label = PLATFORM_LABEL[platform];
    stopped = await stopReason();
    if (stopped) break;
    // Publicaciones importadas en esta ejecución (con tope, los comentarios se limitan a ellas).
    let keptPosts: Set<string> | null = null;
    // 1. Publicaciones y métricas
    if (POSTS_SUPPORTED.includes(platform)) {
      const prevTo = cursor.postsTo[platform];
      const from =
        prevTo && !deps.refreshFullWindow
          ? new Date(Date.parse(prevTo) - 2 * DAY)
          : initialFrom;
      try {
        const page = await mc.fetchPosts(platform, {
          from,
          to: now,
          timezone: deps.timezone ?? 'America/Bogota',
          limit: 500,
        });
        // Una publicación puede llegar por dos rutas (posts y reels): una sola fila y una sola
        // medición por ejecución.
        const unique = [
          ...new Map(page.items.map((p) => [p.externalId, p])).values(),
        ];
        const items =
          cap == null
            ? unique
            : [...unique]
                .sort(
                  (a, b) =>
                    (Date.parse(b.publishedAt ?? '') || 0) -
                    (Date.parse(a.publishedAt ?? '') || 0),
                )
                .slice(0, cap);
        if (cap != null) keptPosts = new Set(items.map((p) => p.externalId));
        const r = await deps.store.upsertPosts(deps.orgId, items, at);
        run.postsInserted += r.inserted;
        run.postsUpdated += r.updated;
        run.snapshots += r.snapshots;
        if (r.mediaRenewed !== undefined)
          run.mediaRenewed = (run.mediaRenewed ?? 0) + r.mediaRenewed;
        cursor.postsTo[platform] = at;
        const withMedia = items.filter(
          (p) => (p.media?.length ?? 0) > 0,
        ).length;
        const capped =
          cap != null && unique.length > items.length
            ? ` (las ${items.length} más recientes de ${unique.length}; tope del piloto)`
            : '';
        cells.push(
          cell(
            platform,
            'posts',
            cap != null && unique.length > items.length
              ? 'partial'
              : 'complete',
            `${items.length} importadas${capped}; ${withMedia} con foto o miniatura`,
            items.length,
          ),
        );
        cells.push(
          cell(
            platform,
            'post_metrics',
            'complete',
            'Métricas por publicación con su nombre real',
            r.snapshots,
          ),
        );
      } catch (e) {
        if (e instanceof SyncPersistenceError) {
          run.errors.push({
            platform,
            dataKind: 'posts',
            kind: 'persistence',
            message: e.message,
            retryable: false,
          });
          cells.push(cell(platform, 'posts', 'unavailable', e.message, 0));
          cells.push(
            cell(
              platform,
              'post_metrics',
              'unavailable',
              'Sin publicaciones guardadas en esta ejecución',
              0,
            ),
          );
          continue;
        }
        const err = asMcError(e);
        if (err.kind === 'auth') {
          authFailure = err;
          break;
        }
        run.errors.push(toSyncError(err, platform, 'posts'));
        cells.push(
          cell(
            platform,
            'posts',
            'unavailable',
            `Error de Metricool: ${err.message}`,
            0,
          ),
        );
        cells.push(
          cell(
            platform,
            'post_metrics',
            'unavailable',
            'Sin publicaciones en esta ejecución',
            0,
          ),
        );
      }
    } else {
      const why =
        POSTS_UNSUPPORTED_REASON[platform] ??
        `Metricool no entrega publicaciones de ${label}`;
      cells.push(cell(platform, 'posts', 'unavailable', why, 0));
      cells.push(cell(platform, 'post_metrics', 'unavailable', why, 0));
    }

    // 2. Comentarios y respuestas
    const a = auths.find((x) => x.platform === platform);
    if (deps.importComments === false) {
      cells.push(
        cell(
          platform,
          'comments',
          'not_requested',
          'Importación de comentarios desactivada por la política de privacidad del piloto (doc 20): no se leen ni se guardan',
          0,
        ),
      );
    } else if (cap != null && !keptPosts) {
      cells.push(
        cell(
          platform,
          'comments',
          'unavailable',
          'Sin publicaciones importadas en esta ejecución: no se leen comentarios',
          0,
        ),
      );
    } else if (!a?.granted) {
      cells.push(
        cell(
          platform,
          'comments',
          'not_permitted',
          a?.detail ?? 'Sin autorización de comentarios',
          0,
        ),
      );
    } else {
      const since = cursor.commentsSince[platform];
      const from = since
        ? new Date(Date.parse(since) - 3_600_000)
        : initialFrom;
      const c = {
        fetched: 0,
        outOfScope: 0,
        inserted: 0,
        duplicates: 0,
        overLimit: 0,
        health: 0,
        redactions: 0,
        failed: 0,
      };
      let newest = since ? Date.parse(since) : 0;
      let pages = 0;
      let next: string | null = null;
      let pending = 0; // aceptados de la página en curso (aún no guardados)
      const summary = () =>
        `${c.fetched} leídos · ${c.inserted} guardados · ${c.duplicates} duplicados · ${c.outOfScope} fuera de alcance · ${c.health} con información de salud (texto no guardado)` +
        (c.overLimit ? ` · ${c.overLimit} sobre el límite diario` : '') +
        (c.failed ? ` · ${c.failed} NO guardados por error interno` : '');
      const commit = () => {
        run.commentsFetched = (run.commentsFetched ?? 0) + c.fetched;
        run.commentsOutOfScope = (run.commentsOutOfScope ?? 0) + c.outOfScope;
        run.commentsInserted += c.inserted;
        run.duplicates += c.duplicates;
        run.overLimit += c.overLimit;
        redactions += c.redactions;
        healthWithheld += c.health;
        if (c.failed) run.commentsFailed = (run.commentsFailed ?? 0) + c.failed;
      };
      try {
        do {
          if (pages > 0) {
            stopped = await stopReason();
            if (stopped) {
              // Lo ya guardado en páginas anteriores se conserva; el cursor no avanza.
              commit();
              break networks;
            }
          }
          const r = await mc.fetchThreads(platform, next);
          const threadMedia = threadPostMedia(r.threads);
          if (keptPosts)
            for (const k of [...threadMedia.keys()])
              if (!keptPosts.has(k)) threadMedia.delete(k);
          await deps.store.enrichPostMedia(deps.orgId, platform, threadMedia);
          const all = flattenThreads(platform, r.threads);
          c.fetched += all.length;
          const inScope = all.filter((x) => {
            const t = Date.parse(x.publishedAt);
            return (
              t >= from.getTime() &&
              t <= now.getTime() &&
              (!keptPosts ||
                (x.postExternalId != null && keptPosts.has(x.postExternalId)))
            );
          });
          c.outOfScope += all.length - inScope.length;
          let pageRedactions = 0;
          const withheldIds = new Set<string>();
          const flat = inScope
            .map((x) => {
              if (!deps.protectPersonalData) return x;
              const p = protectComment(x);
              pageRedactions += p.redactions;
              if (p.healthWithheld) withheldIds.add(x.externalId);
              return p.comment;
            })
            .map((x) =>
              deps.store.authorKey
                ? {
                    ...x,
                    authorExternalId: deps.store.authorKey(
                      deps.orgId,
                      platform,
                      x.authorExternalId,
                    ),
                  }
                : x,
            );
          const known = await deps.store.knownComments(deps.orgId);
          const plan = planIngestion({
            incoming: flat,
            knownExternalIds: known.ids,
            knownHashesByAuthor: known.authorHashes,
            itemsIngestedToday: itemsUsed,
            maxItemsPerDay: state.maxItemsPerDay,
          });
          pending = plan.accepted.length;
          const n = await deps.store.insertComments(
            deps.orgId,
            plan.accepted,
            at,
          );
          pending = 0;
          // Solo cuenta lo que la base confirmó como guardado.
          c.inserted += n;
          itemsUsed += n;
          c.duplicates += plan.duplicates + (plan.accepted.length - n);
          c.overLimit += plan.overLimit;
          c.redactions += pageRedactions;
          c.health += plan.accepted.filter((x) =>
            withheldIds.has(x.externalId),
          ).length;
          for (const x of plan.accepted)
            newest = Math.max(newest, Date.parse(x.publishedAt));
          next = r.next;
          pages++;
        } while (next && pages < (deps.maxCommentPages ?? 10));
        commit();
        if (newest > 0)
          cursor.commentsSince[platform] = new Date(newest).toISOString();
        cells.push(
          cell(
            platform,
            'comments',
            c.fetched === 0 ? 'complete' : 'partial',
            (c.fetched === 0
              ? 'Metricool no devolvió comentarios de publicaciones propias en la ventana'
              : `Comentarios y respuestas de publicaciones propias: ${summary()}`) +
              (deps.protectPersonalData
                ? '; datos personales enmascarados, sin nombres ni imágenes de autores'
                : ''),
            c.inserted,
          ),
        );
      } catch (e) {
        if (e instanceof SyncPersistenceError) {
          c.failed += pending;
          commit();
          run.errors.push({
            platform,
            dataKind: 'comments',
            kind: 'persistence',
            message: e.message,
            retryable: false,
          });
          cells.push(
            cell(
              platform,
              'comments',
              'unavailable',
              `Error interno de Hey Foxy al guardar (no es una limitación de Metricool): ${summary()}`,
              c.inserted,
            ),
          );
        } else {
          const err = asMcError(e);
          if (err.kind === 'auth') {
            authFailure = err;
            break;
          }
          commit();
          run.errors.push(toSyncError(err, platform, 'comments'));
          cells.push(
            cell(
              platform,
              'comments',
              'unavailable',
              `Error de Metricool: ${err.message}`,
              c.inserted,
            ),
          );
        }
      }
    }
    cells.push(
      cell(
        platform,
        'mentions',
        'unavailable',
        'Metricool no expone menciones de terceros',
        0,
      ),
    );
  }

  run.apiCalls = budget.used;
  if (deps.protectPersonalData) {
    run.redactions = redactions;
    run.healthWithheld = healthWithheld;
  }
  const usage = {
    apiCallsDate: today,
    apiCallsToday: callsToday + budget.used,
    itemsDate: today,
    itemsToday: itemsUsed,
  };

  if (stopped) {
    run.errors.unshift(skip(`Detenida durante la ejecución: ${stopped}`));
    // Sin recalcular cobertura (incompleta) y sin avanzar cursores de redes no terminadas:
    // `cursor` solo contiene lo completado antes de la parada.
    return finish('stopped', run, { ...usage, cursor });
  }
  if (authFailure) {
    run.errors.unshift(toSyncError(authFailure, null, null));
    if (authFailure.kind === 'brand_not_authorized') {
      return finish('skipped_not_authorized', run, {
        ...usage,
        status: 'error',
        statusReason: 'Marca no autorizada para esta organización',
      });
    }
    return finish('failed', run, {
      ...usage,
      status: 'error',
      statusReason:
        'Credenciales inválidas o caducadas: Álvaro debe renovar el token en Metricool y cargarlo en el servidor',
      consecutiveFailures: state.consecutiveFailures + 1,
    });
  }
  await deps.store.replaceCoverage(deps.orgId, cells);
  const status: SyncRunStatus = run.errors.length ? 'partial' : 'succeeded';
  return finish(status, run, {
    ...usage,
    cursor,
    status: 'connected',
    statusReason: null,
    consecutiveFailures:
      status === 'succeeded' ? 0 : state.consecutiveFailures + 1,
  });
}

function cell(
  platform: Platform,
  dataKind: CoverageCell['dataKind'],
  status: CoverageCell['status'],
  reason: string,
  items: number,
): CoverageCell {
  return { platform, dataKind, status, reason, items };
}

function skip(message: string): SyncError {
  return {
    platform: null,
    dataKind: null,
    kind: 'skipped',
    message,
    retryable: false,
  };
}

function asMcError(e: unknown): MetricoolError {
  if (e instanceof MetricoolError) return e;
  return new MetricoolError(
    'network',
    (e as Error)?.message ?? 'Error desconocido',
  );
}

function toSyncError(
  e: MetricoolError,
  platform: Platform | null,
  dataKind: CoverageCell['dataKind'] | null,
): SyncError {
  return {
    platform,
    dataKind,
    kind: e.kind,
    message: e.message,
    retryable: e.retryable,
  };
}
