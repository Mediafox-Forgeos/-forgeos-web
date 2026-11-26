import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  commentRow,
  jobRow,
  mediaRows,
  postRow,
  snapshotRow,
} from '@/lib/sync/supabase-mapping';
import type { SyncRun } from '@/lib/sync/types';

/*
 * Persistencia REAL contra Postgres con las migraciones 0001–0006 (scripts/test-sync-persistence.sh).
 * Inserta las filas que construye el código, solo con sus columnas (como PostgREST), y comprueba
 * restricciones, guardas multiempresa y deduplicación. Se omite si no hay base de prueba.
 */
const PG = process.env.HF_TEST_PG; // "host port"
const ORG = '9c000000-0000-4000-a000-0000000000c1';
const SRC = '9c000000-0000-4000-c000-000000000001';
const AURORA = '9a000000-0000-4000-a000-0000000000a1';
const AURORA_SRC = '9a000000-0000-4000-c000-000000000002';
const T = '2026-11-25T12:00:00.000Z';

function psql(sql: string): string {
  const [host, port] = PG!.split(' ');
  return execFileSync(
    'psql',
    [
      '-h',
      host!,
      '-p',
      port!,
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-X',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}
const lit = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
/** INSERT con solo las claves de la fila (lo que hace PostgREST). */
function insert(table: string, row: object, suffix = 'returning id') {
  const cols = Object.keys(row).join(', ');
  return psql(
    `insert into public.${table} (${cols}) select ${cols} from jsonb_populate_record(null::public.${table}, ${lit(row)}) ${suffix}`,
  );
}

const post = {
  externalId: 'mp-ig-1',
  platform: 'instagram' as const,
  accountExternalId: null,
  body: 'Publicación propia',
  permalink: 'https://www.instagram.com/p/fixture/',
  publishedAt: T,
  contentType: 'carousel' as const,
  author: { display: 'Marca', handle: 'marca', avatarUrl: null },
  media: [
    { kind: 'image' as const, sourceUrl: 'https://cdn.example.invalid/1.jpg' },
    {
      kind: 'video' as const,
      sourceUrl: 'https://cdn.example.invalid/2.jpg',
      previewUrl: 'https://cdn.example.invalid/2.jpg',
      durationSec: 12,
    },
  ],
  mediaCountReported: 2,
  metrics: {
    likes: 10,
    comments: 2,
    reach: 100,
    impressionsUnique: 90,
    saves: 1,
    engagement: 3.5,
    reactions: { like: 8, love: 2 },
  },
};
const comment = (id: string, body = '[correo] gracias') => ({
  externalId: id,
  parentExternalId: null,
  postExternalId: 'mp-ig-1',
  platform: 'instagram' as const,
  body,
  authorExternalId: 'hmac-autor',
  authorDisplay: null,
  publishedAt: T,
  permalink: 'https://www.instagram.com/p/fixture/',
  mediaUrl: null,
  contentHash: `h-${id}`,
});

describe.skipIf(!PG)('Persistencia contra Postgres con 0001–0006', () => {
  it('publicación, métricas, medios, comentario y ejecución se guardan con el esquema real', () => {
    const postId = insert('social_posts', postRow(ORG, SRC, post));
    expect(postId).toMatch(/^[0-9a-f-]{36}$/);
    insert('post_metric_snapshots', snapshotRow(ORG, postId, post, T));
    for (const m of mediaRows(ORG, postId, post, 90, T))
      insert('post_media', m);
    insert('social_comments', commentRow(ORG, SRC, postId, comment('c-1')));
    const run: SyncRun = {
      id: 'run-pg-1',
      trigger: 'manual',
      status: 'partial',
      startedAt: T,
      finishedAt: T,
      postsInserted: 1,
      postsUpdated: 0,
      snapshots: 1,
      commentsInserted: 1,
      duplicates: 0,
      overLimit: 0,
      apiCalls: 3,
      commentsFetched: 2,
      commentsOutOfScope: 1,
      errors: [],
    };
    insert('ingestion_jobs', { ...jobRow(ORG, SRC, run), status: 'succeeded' });
    expect(
      psql(
        `select count(*) from public.post_media where post_id = '${postId}'`,
      ),
    ).toBe('2');
    expect(
      psql(
        `select copy_allowed or stored_object_path is not null from public.post_media where post_id = '${postId}' limit 1`,
      ),
    ).toBe('f');
    expect(
      psql(
        `select (cursor::jsonb->'run'->>'commentsFetched')::int from public.ingestion_jobs where idempotency_key = 'metricool:run-pg-1'`,
      ),
    ).toBe('2');
  });

  it('un comentario repetido no se duplica (restricción única, como ignoreDuplicates)', () => {
    const postId = psql(
      `select id from public.social_posts where external_id = 'mp-ig-1'`,
    );
    insert(
      'social_comments',
      commentRow(ORG, SRC, postId, comment('c-1')),
      'on conflict (organization_id, data_source_id, external_id) do nothing returning id',
    );
    expect(
      psql(
        `select count(*) from public.social_comments where external_id = 'c-1'`,
      ),
    ).toBe('1');
  });

  it('la organización demo (Clínica Aurora) rechaza datos reales', () => {
    expect(() =>
      insert(
        'social_posts',
        postRow(AURORA, AURORA_SRC, { ...post, externalId: 'x' }),
      ),
    ).toThrow(/demo organization/);
  });

  it('la fila de comentario anterior a la corrección (con permalink) fallaba', () => {
    const postId = psql(
      `select id from public.social_posts where external_id = 'mp-ig-1'`,
    );
    expect(() =>
      insert('social_comments', {
        ...commentRow(ORG, SRC, postId, comment('c-2')),
        permalink: 'https://x',
      }),
    ).toThrow(/permalink/);
  });
});
