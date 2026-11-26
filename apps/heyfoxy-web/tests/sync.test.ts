import { describe, expect, it } from 'vitest';
import {
  MetricoolConnector,
  MetricoolError,
  isAllowedMetricoolPath,
  type CallBudget,
} from '@/lib/connectors/metricool';
import { runSync } from '@/lib/sync/engine';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
  type FixtureScenario,
} from '@/lib/sync/fixtures';
import { MemorySyncStore } from '@/lib/sync/memory-store';
import { initialState } from '@/lib/sync/types';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const T0 = new Date('2026-11-23T12:00:00Z');

function setup(scenario: FixtureScenario = {}, token = FIXTURE_TOKEN) {
  const f = fixtureFetch(scenario);
  const sleeps: number[] = [];
  const store = new MemorySyncStore();
  const connector = (budget?: CallBudget) =>
    new MetricoolConnector({
      enabled: true,
      token,
      userId: FIXTURE_USER,
      blogId: FIXTURE_BLOG,
      fetchImpl: f.impl,
      minIntervalMs: 0,
      retryBaseMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      budget,
    });
  return { f, sleeps, store, connector };
}

async function connect(store: MemorySyncStore, org = ORG_A, over = {}) {
  await store.save(org, {
    ...initialState(),
    status: 'connected',
    brand: {
      blogId: FIXTURE_BLOG,
      label: 'Marca sintética QA',
      networks: ['instagram', 'facebook', 'linkedin', 'tiktok'],
      tokenExpirations: {},
    },
    ...over,
  });
}

describe('Metricool: conexión y validación de credenciales', () => {
  it('conexión correcta: lista marcas y redes sin leer contenido', async () => {
    const { connector, f } = setup();
    const brands = await connector().listBrands();
    expect(brands.map((b) => b.label)).toEqual([
      'Marca sintética QA',
      'Otra marca sintética',
    ]);
    expect(brands[0]!.networks).toEqual([
      'instagram',
      'facebook',
      'linkedin',
      'tiktok',
    ]);
    expect(brands[0]!.tokenExpirations.linkedin).toBe('2027-01-31T00:00:00Z');
    expect(f.calls.map((c) => c.path)).toEqual(['/admin/simpleProfiles']);
    expect(f.calls[0]!.query.blogId).toBeUndefined();
  });
  it('credenciales inválidas: error de autenticación sin reintentos ni filtrar el token', async () => {
    const { connector, f } = setup({}, 'token-equivocado');
    const e = await connector()
      .listBrands()
      .catch((x) => x);
    expect(e).toBeInstanceOf(MetricoolError);
    expect((e as MetricoolError).kind).toBe('auth');
    expect(String(e)).not.toContain('token-equivocado');
    expect(f.calls).toHaveLength(1);
  });
});

describe('Metricool: sincronización completa', () => {
  it('importa publicaciones, métricas, comentarios y respuestas; deduplica', async () => {
    const { store, connector, f } = setup();
    await connect(store);
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.status).toBe('succeeded');
    expect(run.postsInserted).toBe(5); // 3 posts + 1 reel de Instagram, 1 de Facebook
    expect(run.commentsInserted).toBe(4); // raíz + respuesta IG, otra raíz IG, raíz FB
    expect(run.duplicates).toBe(2); // mismo id + mismo autor y texto con otro id
    expect(
      f.calls.every(
        (c) => c.method === 'GET' && isAllowedMetricoolPath(c.path),
      ),
    ).toBe(true);
    const state = (await store.load(ORG_A))!;
    expect(state.lastSyncStatus).toBe('succeeded');
    expect(state.apiCallsToday).toBe(run.apiCalls);
    expect(state.cursor.postsTo?.instagram).toBe(T0.toISOString());
  });

  it('medios: con imagen, sin imagen, carrusel parcial y video con miniatura', async () => {
    const { store, connector } = setup();
    await connect(store);
    await runSync({ orgId: ORG_A, store, connector, now: T0 });
    const posts = new Map(
      (await store.posts(ORG_A)).map((p) => [p.externalId, p]),
    );
    expect(posts.get('ig-img-1')!.media).toEqual([
      { kind: 'image', sourceUrl: expect.stringMatching(/^https:\/\//) },
    ]);
    expect(posts.get('ig-txt-3')!.media).toEqual([]);
    const car = posts.get('ig-car-2')!;
    expect(car.contentType).toBe('carousel');
    expect(car.media).toHaveLength(2); // la analítica trae 1; el hilo de comentarios, 2
    expect(car.mediaCountReported).toBe(2);
    const reel = posts.get('ig-reel-4')!;
    expect(reel.contentType).toBe('reel');
    expect(reel.media![0]).toMatchObject({
      kind: 'video',
      previewUrl: expect.any(String),
      durationSec: 42,
    });
  });

  it('métricas con su nombre real: impresiones únicas no se convierten en alcance', async () => {
    const { store, connector } = setup();
    await connect(store);
    await runSync({ orgId: ORG_A, store, connector, now: T0 });
    const fb = (await store.posts(ORG_A)).find((p) => p.externalId === 'fb-5')!;
    expect(fb.metrics.reach).toBeUndefined();
    expect(fb.metrics.impressionsUnique).toBe(5400);
    expect(fb.metrics.reactions).toEqual({ like: 180, love: 25, wow: 5 });
    expect(fb.permalink).toBe('https://www.facebook.com/100000001/posts/5');
    expect(fb.author?.display).toBe('Marca Sintética');
  });

  it('cobertura real por red y tipo de dato', async () => {
    const { store, connector } = setup({ commentScopes: ['instagram'] });
    await connect(store);
    await runSync({ orgId: ORG_A, store, connector, now: T0 });
    const cov = await store.coverage(ORG_A);
    const get = (p: string, k: string) =>
      cov.find((c) => c.platform === p && c.dataKind === k)!;
    expect(get('instagram', 'posts').status).toBe('complete');
    expect(get('instagram', 'comments').status).toBe('partial');
    expect(get('facebook', 'comments').status).toBe('not_permitted');
    expect(get('facebook', 'comments').reason).toContain(
      'pages_read_user_content',
    );
    expect(get('tiktok', 'posts').status).toBe('unavailable');
    expect(get('tiktok', 'posts').reason).toContain('CSV');
    expect(get('linkedin', 'posts').status).toBe('unavailable');
    expect(get('instagram', 'mentions').status).toBe('unavailable');
  });
});

describe('Metricool: incremental, errores y límites', () => {
  it('sincronización incremental: solo lo nuevo, con solape y sin duplicar', async () => {
    const { store, connector } = setup({
      extraComments: [
        {
          provider: 'instagram',
          postId: 'ig-img-1',
          id: 'c-ig-new',
          text: '[SINTÉTICO] Comentario nuevo',
          at: '2026-11-24T08:00:00Z',
        },
      ],
    });
    await connect(store);
    await runSync({ orgId: ORG_A, store, connector, now: T0 }); // el nuevo aún está en el futuro
    const f2 = setup({
      extraComments: [
        {
          provider: 'instagram',
          postId: 'ig-img-1',
          id: 'c-ig-new',
          text: '[SINTÉTICO] Comentario nuevo',
          at: '2026-11-24T08:00:00Z',
        },
      ],
    });
    const t1 = new Date('2026-11-24T12:00:00Z');
    const run2 = await runSync({
      orgId: ORG_A,
      store,
      connector: f2.connector,
      now: t1,
    });
    expect(run2.commentsInserted).toBe(1);
    expect(run2.postsInserted).toBe(0);
    expect(run2.postsUpdated).toBe(5);
    const postsCall = f2.f.calls.find(
      (c) => c.path === '/v2/analytics/posts/instagram',
    )!;
    expect(postsCall.query.from).toBe('2026-11-21T12:00:00'); // fin anterior − 48 h
    expect((await store.counts(ORG_A)).snapshots).toBe(10); // una medición por publicación y ejecución
  });

  it('token caducado a mitad: falla, marca error y no avanza el cursor', async () => {
    const { store, connector } = setup({ expireAfterCalls: 3 });
    await connect(store);
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.status).toBe('failed');
    expect(run.errors[0]!.kind).toBe('auth');
    const s = (await store.load(ORG_A))!;
    expect(s.status).toBe('error');
    expect(s.statusReason).toContain('renovar el token');
    expect(s.cursor.postsTo).toBeUndefined();
    expect(s.consecutiveFailures).toBe(1);
  });

  it('límite de API transitorio: reintenta respetando Retry-After', async () => {
    const { store, connector, sleeps } = setup({ rateLimitFirst: 2 });
    await connect(store);
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.status).toBe('succeeded');
    expect(sleeps.slice(0, 2)).toEqual([1000, 1000]);
  });

  it('límite de API persistente: agota reintentos, resultado fallido con error reintentable', async () => {
    const { store, connector } = setup({ rateLimitAlways: true });
    await connect(store);
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(['partial', 'failed']).toContain(run.status);
    expect(run.errors.some((e) => e.kind === 'rate_limit' && e.retryable)).toBe(
      true,
    );
  });

  it('error de red en una red: resultado parcial, las demás siguen', async () => {
    const { store, connector } = setup({ networkErrorOn: /posts\/facebook/ });
    await connect(store);
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.status).toBe('partial');
    expect(run.errors).toEqual([
      expect.objectContaining({
        platform: 'facebook',
        dataKind: 'posts',
        kind: 'network',
        retryable: true,
      }),
    ]);
    expect(run.postsInserted).toBe(4); // Instagram completo
  });

  it('presupuesto diario de llamadas: corta la ejecución y luego la omite', async () => {
    const { store, connector, f } = setup();
    await connect(store, ORG_A, { maxApiCallsPerDay: 3 });
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.apiCalls).toBe(3);
    expect(run.errors.some((e) => e.kind === 'budget')).toBe(true);
    const before = f.calls.length;
    const run2 = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run2.status).toBe('skipped_budget');
    expect(f.calls.length).toBe(before);
    // Al día siguiente el contador se reinicia.
    const run3 = await runSync({
      orgId: ORG_A,
      store,
      connector,
      now: new Date('2026-11-24T12:00:00Z'),
    });
    expect(run3.status).not.toBe('skipped_budget');
  });

  it('límite diario de elementos importados', async () => {
    const { store, connector } = setup();
    await connect(store, ORG_A, { maxItemsPerDay: 2 });
    const run = await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect(run.commentsInserted).toBe(2);
    expect(run.overLimit).toBeGreaterThan(0);
  });
});

describe('Metricool: controles de operación y aislamiento', () => {
  it('interruptor de emergencia y pausa: no tocan la red', async () => {
    const { store, connector, f } = setup();
    await connect(store);
    expect(
      (
        await runSync({
          orgId: ORG_A,
          store,
          connector,
          now: T0,
          killSwitch: true,
        })
      ).status,
    ).toBe('skipped_kill_switch');
    await store.save(ORG_A, { paused: true });
    expect(
      (await runSync({ orgId: ORG_A, store, connector, now: T0 })).status,
    ).toBe('skipped_paused');
    expect(f.calls).toHaveLength(0);
    expect((await store.runs(ORG_A)).map((r) => r.status)).toEqual([
      'skipped_paused',
      'skipped_kill_switch',
    ]);
  });

  it('sin conexión no sincroniza', async () => {
    const { store, connector, f } = setup();
    expect(
      (await runSync({ orgId: ORG_A, store, connector, now: T0 })).status,
    ).toBe('skipped_not_connected');
    expect(f.calls).toHaveLength(0);
  });

  it('aislamiento entre organizaciones en el almacén', async () => {
    const { store, connector } = setup();
    await connect(store, ORG_A);
    await runSync({ orgId: ORG_A, store, connector, now: T0 });
    expect((await store.counts(ORG_A)).posts).toBe(5);
    expect(await store.counts(ORG_B)).toEqual({
      posts: 0,
      comments: 0,
      snapshots: 0,
      postsByPlatform: {},
    });
    expect(await store.coverage(ORG_B)).toEqual([]);
  });
});
