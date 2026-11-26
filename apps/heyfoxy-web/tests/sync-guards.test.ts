import { describe, expect, it } from 'vitest';
import {
  MetricoolConnector,
  MetricoolError,
  type CallBudget,
} from '@/lib/connectors/metricool';
import { runSync } from '@/lib/sync/engine';
import {
  FIXTURE_BLOG,
  FIXTURE_TOKEN,
  FIXTURE_USER,
  fixtureFetch,
} from '@/lib/sync/fixtures';
import {
  parseAllowedBrands,
  serviceKeyKind,
  serviceKeyProblem,
  serviceKeyUsable,
} from '@/lib/sync/guards';
import { MemorySyncStore } from '@/lib/sync/memory-store';
import { initialState } from '@/lib/sync/types';

/*
 * GO 1 — controles antes de la primera conexión real:
 *  - solo la marca expresamente autorizada para la organización se importa;
 *  - el interruptor de emergencia (y la pausa) detienen una ejecución EN CURSO;
 *  - la clave de Supabase del servidor es una clave secreta, no una pública.
 * Todo con el servidor Metricool sintético: ninguna llamada sale a la red.
 */
const ORG = 'org-real';
const T0 = new Date('2026-11-23T12:00:00Z');
// Formatos de clave INVENTADOS para la prueba (se construyen por partes para que ningún
// escáner de secretos los confunda con claves reales).
const FAKE_SECRET = ['sb', 'secret', 'x'.repeat(22), '0'.repeat(8)].join('_');
const FAKE_PUBLISHABLE = [
  'sb',
  'publishable',
  'x'.repeat(22),
  '0'.repeat(8),
].join('_');
const jwt = (payload: object) =>
  [
    Buffer.from('{"alg":"HS256"}').toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'firma',
  ].join('.');

function setup(allowedBlogIds?: string[]) {
  const f = fixtureFetch({});
  const store = new MemorySyncStore();
  const connector = (budget?: CallBudget) =>
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
      allowedBlogIds,
    });
  return { f, store, connector };
}

async function connect(store: MemorySyncStore, blogId = FIXTURE_BLOG) {
  await store.save(ORG, {
    ...initialState(),
    status: 'connected',
    brand: {
      blogId,
      label: 'Marca',
      networks: ['instagram', 'facebook'],
      tokenExpirations: {},
    },
  });
}

describe('Clave de Supabase del servidor', () => {
  it('acepta la clave secreta nueva y la service_role antigua', () => {
    expect(serviceKeyKind(FAKE_SECRET)).toBe('secret');
    expect(serviceKeyKind(jwt({ role: 'service_role' }))).toBe(
      'service_role_jwt',
    );
    expect(serviceKeyUsable('secret')).toBe(true);
    expect(serviceKeyUsable('service_role_jwt')).toBe(true);
  });
  it('rechaza claves públicas, vacías o con otro formato, sin revelar su valor', () => {
    for (const [key, kind] of [
      [FAKE_PUBLISHABLE, 'publishable'],
      [jwt({ role: 'anon' }), 'anon_jwt'],
      ['', 'missing'],
      [undefined, 'missing'],
      ['clave-cualquiera', 'unknown'],
    ] as const) {
      const k = serviceKeyKind(key);
      expect(k).toBe(kind);
      expect(serviceKeyUsable(k)).toBe(false);
      const msg = serviceKeyProblem(k)!;
      expect(msg).toBeTruthy();
      if (key) expect(msg).not.toContain(key);
    }
  });
});

describe('Marca autorizada por organización', () => {
  it('lee HF_METRICOOL_ALLOWED_BRANDS e ignora entradas mal formadas', () => {
    const r = parseAllowedBrands(
      '9c000000-0000-4000-a000-0000000000c1:700001, basura, 9c000000-0000-4000-a000-0000000000c1:700002,otra:123',
    );
    expect([...r.byOrg.get('9c000000-0000-4000-a000-0000000000c1')!]).toEqual([
      '700001',
      '700002',
    ]);
    expect(r.invalid).toBe(2);
    expect(parseAllowedBrands(undefined).byOrg.size).toBe(0);
  });

  it('una marca no autorizada no se sincroniza y no sale ninguna llamada', async () => {
    const { store, connector, f } = setup();
    await connect(store);
    const run = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      allowedBlogIds: ['999999'],
    });
    expect(run.status).toBe('skipped_not_authorized');
    expect(f.calls).toHaveLength(0);
    expect((await store.counts(ORG)).posts).toBe(0);
    expect((await store.load(ORG))!.status).toBe('error');
  });

  it('defensa en el conector: ninguna llamada con marca fuera de la lista sale a la red', async () => {
    const { connector, f } = setup(['999999']);
    const e = await connector()
      .fetchPosts('instagram', {
        from: new Date('2026-10-01T00:00:00Z'),
        to: T0,
        timezone: 'America/Bogota',
        limit: 10,
      })
      .catch((x) => x);
    expect(e).toBeInstanceOf(MetricoolError);
    expect((e as MetricoolError).kind).toBe('brand_not_authorized');
    expect(f.calls).toHaveLength(0);
    // Listar marcas (sin blogId) sigue permitido: solo valida credenciales.
    await connector().listBrands();
    expect(f.calls.map((c) => c.path)).toEqual(['/admin/simpleProfiles']);
  });

  it('la marca autorizada se sincroniza con normalidad', async () => {
    const { store, connector } = setup([FIXTURE_BLOG]);
    await connect(store);
    const run = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      initialDays: 120,
      allowedBlogIds: [FIXTURE_BLOG],
    });
    expect(run.status).toBe('succeeded');
    expect(run.postsInserted).toBeGreaterThan(0);
  });
});

describe('Interruptor de emergencia y pausa en caliente', () => {
  it('interruptor global de la base activo antes de empezar: no toca la red', async () => {
    const { store, connector, f } = setup();
    await connect(store);
    store.killSwitch = true;
    const run = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      stop: async () =>
        (await store.globalKillSwitch()) ? 'interruptor global' : null,
    });
    expect(run.status).toBe('skipped_kill_switch');
    expect(f.calls).toHaveLength(0);
  });

  it('activado DURANTE la ejecución: se detiene antes de la siguiente llamada', async () => {
    const { store, connector, f } = setup();
    await connect(store);
    let checks = 0;
    const run = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      initialDays: 120,
      // Primera comprobación (inicio) y primera red: libre; después, interruptor activado.
      stop: async () => {
        checks++;
        if (checks === 2) store.killSwitch = true;
        return checks > 2 && (await store.globalKillSwitch())
          ? 'interruptor global'
          : null;
      },
    });
    expect(run.status).toBe('stopped');
    expect(run.errors[0]!.message).toContain('interruptor global');
    const callsAtStop = f.calls.length;
    // Solo se procesó la primera red (Instagram); Facebook no se consultó.
    expect(f.calls.some((c) => c.query.network === 'facebook')).toBe(false);
    expect(f.calls.some((c) => c.path.includes('facebook'))).toBe(false);
    // Una ejecución posterior con el interruptor activo no hace ninguna llamada.
    const again = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      stop: async () =>
        (await store.globalKillSwitch()) ? 'interruptor global' : null,
    });
    expect(again.status).toBe('skipped_kill_switch');
    expect(f.calls.length).toBe(callsAtStop);
    expect((await store.runs(ORG)).map((r) => r.status)).toEqual([
      'skipped_kill_switch',
      'stopped',
    ]);
  });

  it('pausa de la organización durante la ejecución: también se detiene', async () => {
    const { store, connector } = setup();
    await connect(store);
    let checks = 0;
    const run = await runSync({
      orgId: ORG,
      store,
      connector,
      now: T0,
      initialDays: 120,
      stop: async () => {
        checks++;
        if (checks === 2) await store.save(ORG, { paused: true });
        const st = await store.load(ORG);
        return checks > 2 && st?.paused ? 'pausada por la organización' : null;
      },
    });
    expect(run.status).toBe('stopped');
    expect((await store.load(ORG))!.lastSyncStatus).toBe('stopped');
  });
});
