import { describe, expect, it } from 'vitest';
import {
  MetricoolConnector,
  type CallBudget,
} from '@/lib/connectors/metricool';
import type { NormalizedComment } from '@/lib/connectors/types';
import { runSync } from '@/lib/sync/engine';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
} from '@/lib/sync/fixtures';
import { MemorySyncStore } from '@/lib/sync/memory-store';
import { PILOT_LIMITS } from '@/lib/sync/pilot';
import {
  commentRow,
  jobRow,
  mediaRows,
  postRow,
  runFromJob,
  snapshotRow,
} from '@/lib/sync/supabase-mapping';
import {
  initialState,
  SyncPersistenceError,
  type SyncRun,
} from '@/lib/sync/types';
import SCHEMA from './schema/columns-0006.json';

/*
 * WO-HF-METRICOOL-FIX-001: persistencia contra el contrato de esquema, contadores honestos,
 * error interno ≠ limitación de la fuente, reintento sin duplicar y política de comentarios.
 * Servidor Metricool sintético; ninguna llamada sale a la red.
 */
const ORG = 'org-fix';
const T0 = new Date('2026-11-23T12:00:00Z');
const cols = (t: keyof typeof SCHEMA) => new Set<string>(SCHEMA[t]);
const keysOk = (t: keyof typeof SCHEMA, row: object) =>
  Object.keys(row).filter((k) => !cols(t).has(k));

/** Almacén en memoria cuyo guardado de comentarios falla como lo hizo la base (PGRST204). */
class FailingCommentsStore extends MemorySyncStore {
  failComments = true;
  override async insertComments(
    orgId: string,
    comments: Array<NormalizedComment & { contentHash: string }>,
    at: string,
  ) {
    if (this.failComments && comments.length)
      throw new SyncPersistenceError('social_comments', 'PGRST204');
    return super.insertComments(orgId, comments, at);
  }
}

async function sync(
  store: MemorySyncStore,
  opts: { importComments?: boolean; extra?: object } = {},
) {
  const f = fixtureFetch(opts.extra ?? {});
  if (!(await store.load(ORG))?.brand)
    await store.save(ORG, {
      ...initialState(),
      status: 'connected',
      brand: {
        blogId: FIXTURE_BLOG,
        label: 'Marca',
        networks: ['instagram', 'facebook'],
        tokenExpirations: {},
      },
    });
  const r = await runSync({
    orgId: ORG,
    store,
    now: T0,
    initialDays: 30,
    ...PILOT_LIMITS,
    importComments: opts.importComments ?? PILOT_LIMITS.importComments,
    connector: (budget?: CallBudget) =>
      new MetricoolConnector({
        enabled: true,
        token: FIXTURE_TOKEN,
        userId: FIXTURE_USER,
        blogId: FIXTURE_BLOG,
        fetchImpl: f.impl,
        minIntervalMs: 0,
        retryBaseMs: 1,
        sleep: async () => {},
        budget,
        allowedBlogIds: [FIXTURE_BLOG],
      }),
  });
  return { r, f };
}

describe('Contrato de esquema (columnas reales de 0001–0006)', () => {
  const post = {
    externalId: 'p1',
    platform: 'instagram' as const,
    accountExternalId: null,
    body: 'x',
    permalink: 'https://www.instagram.com/p/x/',
    publishedAt: T0.toISOString(),
    contentType: 'image' as const,
    author: { display: 'Marca', handle: 'marca', avatarUrl: null },
    media: [{ kind: 'image' as const, sourceUrl: 'https://cdn.example/x.jpg' }],
    mediaCountReported: null,
    metrics: { likes: 1, impressionsUnique: 2, reactions: { like: 1 } },
  };
  const comment = {
    externalId: 'c1',
    parentExternalId: null,
    postExternalId: 'p1',
    platform: 'instagram' as const,
    body: 'hola',
    authorExternalId: 'h',
    authorDisplay: null,
    publishedAt: T0.toISOString(),
    permalink: 'https://www.instagram.com/p/x/',
    mediaUrl: null,
    contentHash: 'abc',
  };
  const run: SyncRun = {
    id: 'r1',
    trigger: 'manual',
    status: 'partial',
    startedAt: T0.toISOString(),
    finishedAt: T0.toISOString(),
    postsInserted: 14,
    postsUpdated: 0,
    snapshots: 14,
    commentsInserted: 0,
    duplicates: 0,
    overLimit: 0,
    apiCalls: 7,
    commentsFetched: 3,
    commentsFailed: 3,
    errors: [],
  };

  it('ninguna fila escribe columnas que no existen (la causa del error PGRST204)', () => {
    expect(keysOk('social_posts', postRow('o', 's', post))).toEqual([]);
    expect(
      keysOk(
        'post_metric_snapshots',
        snapshotRow('o', 'p', post, T0.toISOString()),
      ),
    ).toEqual([]);
    for (const m of mediaRows('o', 'p', post, 90, T0.toISOString()))
      expect(keysOk('post_media', m)).toEqual([]);
    expect(
      keysOk('social_comments', commentRow('o', 's', 'p', comment)),
    ).toEqual([]);
    expect(keysOk('ingestion_jobs', jobRow('o', 's', run))).toEqual([]);
    expect(cols('social_comments').has('permalink')).toBe(false);
  });

  it('el historial no presenta publicaciones como comentarios', () => {
    const back = runFromJob({
      ...jobRow('o', 's', run),
      idempotency_key: 'metricool:r1',
      started_at: run.startedAt,
      finished_at: run.finishedAt,
    });
    expect(back.postsInserted).toBe(14);
    expect(back.commentsInserted).toBe(0);
    expect(back.commentsFailed).toBe(3);
    expect(back.status).toBe('partial');
    // Fila anterior a este cambio (sin cursor.run): items_inserted eran publicaciones.
    const legacy = runFromJob({
      idempotency_key: 'metricool:old',
      status: 'succeeded',
      items_inserted: 14,
      items_duplicated: 0,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      error: JSON.stringify({
        status: 'partial',
        trigger: 'manual',
        apiCalls: 7,
        errors: [],
      }),
      cursor: null,
    });
    expect(legacy.commentsInserted).toBe(0);
    expect(legacy.postsInserted).toBe(14);
  });
});

describe('Política del piloto: comentarios desactivados', () => {
  it('no lee comentarios ni sus permisos y lo explica en la cobertura', async () => {
    const store = new MemorySyncStore();
    const { r, f } = await sync(store);
    expect(f.calls.some((c) => c.path.startsWith('/v2/inbox'))).toBe(false);
    expect(store.comments(ORG)).toHaveLength(0);
    const cov = await store.coverage(ORG);
    const cc = cov.filter((c) => c.dataKind === 'comments');
    expect(cc.map((c) => c.status)).toEqual(['not_requested', 'not_requested']);
    expect(cc[0]!.reason).toMatch(/política de privacidad/);
    expect(r.status).toBe('succeeded');
    expect((await store.posts(ORG)).length).toBeGreaterThan(0);
  });
});

describe('Error interno de persistencia ≠ limitación de Metricool', () => {
  it('no cuenta como importado lo que no se guardó, conserva publicaciones y permite reintentar sin duplicar', async () => {
    const store = new FailingCommentsStore();
    const { r } = await sync(store, { importComments: true });
    expect(r.status).toBe('partial');
    expect(r.commentsInserted).toBe(0);
    expect(r.commentsFailed).toBeGreaterThan(0);
    const err = r.errors.find((e) => e.dataKind === 'comments')!;
    expect(err.kind).toBe('persistence');
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/no es una limitación de Metricool/);
    expect(err.message).not.toMatch(/permalink|row|fila contiene/i);
    const cov = await store.coverage(ORG);
    expect(
      cov.find(
        (c) =>
          c.dataKind === 'comments' &&
          c.items === 0 &&
          /Error interno/.test(c.reason),
      ),
    ).toBeTruthy();
    const posts1 = (await store.posts(ORG)).length;
    expect(posts1).toBeGreaterThan(0);
    // El cursor de comentarios no avanzó: el reintento los recupera.
    expect((await store.load(ORG))!.cursor.commentsSince ?? {}).toEqual({});

    store.failComments = false;
    const r2 = await sync(store, { importComments: true });
    expect(r2.r.status).toBe('succeeded');
    expect(r2.r.commentsInserted).toBeGreaterThan(0);
    expect(r2.r.commentsInserted).toBe(store.comments(ORG).length);
    expect((await store.posts(ORG)).length).toBe(posts1); // sin duplicar publicaciones

    const r3 = await sync(store, { importComments: true });
    expect(r3.r.commentsInserted).toBe(0);
    expect(store.comments(ORG)).toHaveLength(r2.r.commentsInserted);
    expect((await store.posts(ORG)).length).toBe(posts1);
  });

  it('los contadores cuadran: leídos = guardados + duplicados + fuera de alcance + sobre el límite', async () => {
    const store = new MemorySyncStore();
    const { r } = await sync(store, {
      importComments: true,
      extra: {
        extraComments: [
          {
            provider: 'instagram',
            postId: 'ig-reel-4',
            id: 'c-s1',
            text: 'Me diagnosticaron asma',
            at: '2026-11-22T19:30:00Z',
          },
          {
            provider: 'instagram',
            postId: 'ig-reel-4',
            id: 'c-old',
            text: 'viejo',
            at: '2026-09-01T10:00:00Z',
          },
        ],
      },
    });
    const fetched = r.commentsFetched ?? 0;
    expect(fetched).toBeGreaterThan(0);
    expect(
      r.commentsInserted +
        r.duplicates +
        (r.commentsOutOfScope ?? 0) +
        r.overLimit,
    ).toBe(fetched);
    expect(r.commentsOutOfScope).toBeGreaterThanOrEqual(1);
    expect(r.healthWithheld).toBe(1);
    expect(store.comments(ORG).length).toBe(r.commentsInserted);
  });

  it('aislamiento: una organización no recibe datos de otra', async () => {
    const store = new MemorySyncStore();
    await sync(store, { importComments: true });
    expect(await store.posts('otra-org')).toHaveLength(0);
    expect(store.comments('otra-org')).toHaveLength(0);
  });
});
