import { describe, expect, it } from 'vitest';
import {
  MetricoolConnector,
  type CallBudget,
} from '@/lib/connectors/metricool';
import { runSync } from '@/lib/sync/engine';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
} from '@/lib/sync/fixtures';
import { MemorySyncStore } from '@/lib/sync/memory-store';
import { protectComment, redactPersonalData } from '@/lib/sync/privacy';
import { PILOT_LIMITS } from '@/lib/sync/pilot';
import { initialState } from '@/lib/sync/types';

/*
 * Piloto MedPlus (doc 20): límites de la primera importación y protección de datos personales.
 * Servidor Metricool sintético: ninguna llamada sale a la red y ningún dato es real.
 */
const ORG = 'org-piloto';
const T0 = new Date('2026-11-23T12:00:00Z');
// Datos personales INVENTADOS, construidos por partes (ningún dato real).
const EMAIL = ['paciente', 'ejemplo.invalid'].join('@');
const PHONE = ['+57', '300', '123', '4567'].join(' ');

async function run(extra = {}, maxPostsPerNetwork = 2) {
  const f = fixtureFetch({
    extraComments: [
      {
        provider: 'instagram',
        postId: 'ig-reel-4',
        id: 'c-pii-1',
        text: `Escríbanme a ${EMAIL} o al ${PHONE}, mi cédula 1.020.304.050`,
        at: '2026-11-22T19:00:00Z',
      },
    ],
    ...extra,
  });
  const store = new MemorySyncStore();
  await store.save(ORG, {
    ...initialState(),
    status: 'connected',
    brand: {
      blogId: FIXTURE_BLOG,
      label: 'Marca',
      networks: ['instagram', 'facebook', 'linkedin', 'tiktok'],
      tokenExpirations: {},
    },
  });
  const r = await runSync({
    orgId: ORG,
    store,
    now: T0,
    initialDays: 30,
    ...PILOT_LIMITS,
    maxPostsPerNetwork,
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
  return { r, f, store };
}

describe('Límites del piloto', () => {
  it('son los autorizados: 10 por red, Instagram y Facebook, datos protegidos', () => {
    expect(PILOT_LIMITS.maxPostsPerNetwork).toBe(10);
    expect([...PILOT_LIMITS.networks]).toEqual(['instagram', 'facebook']);
    expect(PILOT_LIMITS.protectPersonalData).toBe(true);
  });

  it('solo llama a Metricool para Instagram y Facebook, aunque la marca tenga más redes', async () => {
    const { f } = await run();
    const providers = new Set(
      f.calls.map((c) => c.query.provider ?? c.path.split('/').pop()),
    );
    for (const p of providers) expect(p).toMatch(/instagram|facebook/);
    expect(f.calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('importa solo las N publicaciones más recientes por red y sus comentarios', async () => {
    const { store, r } = await run();
    const posts = await store.posts(ORG);
    const ig = posts
      .filter((p) => p.platform === 'instagram')
      .map((p) => p.externalId);
    expect(ig.sort()).toEqual(['ig-reel-4', 'ig-txt-3']);
    const comments = store.comments(ORG);
    // ig-img-1 e ig-car-2 quedaron fuera: sus comentarios tampoco se importan.
    expect(
      comments.some((c) =>
        ['ig-img-1', 'ig-car-2'].includes(c.postExternalId!),
      ),
    ).toBe(false);
    expect(comments.some((c) => c.externalId === 'c-pii-1')).toBe(true);
    expect(comments.some((c) => c.postExternalId === 'fb-5')).toBe(true);
    const cov = await store.coverage(ORG);
    expect(
      cov.find((c) => c.platform === 'instagram' && c.dataKind === 'posts')
        ?.reason,
    ).toMatch(/tope del piloto/);
    expect(r.status).toMatch(/succeeded|partial/);
  });

  it('enmascara datos personales y no guarda nombres ni imágenes de autores', async () => {
    const { store, r } = await run();
    const c = store.comments(ORG).find((x) => x.externalId === 'c-pii-1')!;
    expect(c.body).not.toContain(EMAIL);
    expect(c.body).not.toContain('4567');
    expect(c.body).not.toContain('1.020.304.050');
    expect(c.body).toContain('[correo]');
    expect(c.body).toContain('[teléfono]');
    expect(c.body).toContain('[documento]');
    for (const x of store.comments(ORG)) {
      expect(x.authorDisplay).toBeNull();
      expect(x.mediaUrl ?? null).toBeNull();
    }
    expect(r.redactions).toBeGreaterThanOrEqual(3);
  });
});

describe('redactPersonalData', () => {
  it.each([
    [`correo ${EMAIL}`, '[correo]'],
    ['llámame al 3001234567', '[teléfono]'],
    ['tel (601) 555 1234', '[teléfono]'],
    ['CC 79.123.456', '[documento]'],
    ['C.C. 1020304050', '[documento]'],
    ['mi historia clínica 0045-778', '[historia clínica]'],
    ['HC: 123456', '[historia clínica]'],
    ['tarjeta 4111 1111 1111 1111', '[tarjeta]'],
  ])('%s', (input, label) => {
    const r = redactPersonalData(input);
    expect(r.text).toContain(label);
    expect(r.count).toBeGreaterThan(0);
  });

  it('no altera texto sin datos personales', () => {
    const t = 'Excelente atención, gracias al equipo 👏 cita a las 10:30';
    expect(redactPersonalData(t)).toEqual({ text: t, count: 0 });
  });

  it('protectComment elimina nombre visible e imagen adjunta', () => {
    const { comment } = protectComment({
      externalId: 'x',
      parentExternalId: null,
      postExternalId: 'p',
      platform: 'instagram',
      body: 'hola',
      authorExternalId: 'a',
      authorDisplay: 'Nombre Apellido',
      publishedAt: T0.toISOString(),
      permalink: null,
      mediaUrl: 'https://example.invalid/x.jpg',
    });
    expect(comment.authorDisplay).toBeNull();
    expect(comment.mediaUrl).toBeNull();
    expect(comment.authorExternalId).toBe('a');
  });
});
