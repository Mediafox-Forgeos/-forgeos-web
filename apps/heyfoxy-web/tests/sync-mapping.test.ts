import { describe, expect, it } from 'vitest';
import { mapMetricoolPost } from '@/lib/connectors/metricool';
import {
  fixtureFacebookPosts,
  fixtureInstagramReels,
} from '@/lib/sync/fixtures';
import {
  commentRow,
  jobRow,
  mediaRows,
  postRow,
  snapshotRow,
  stateFromRow,
  stateToColumns,
} from '@/lib/sync/supabase-mapping';
import { initialState } from '@/lib/sync/types';

describe('mapeo a las tablas de 0006', () => {
  const fb = mapMetricoolPost('facebook', fixtureFacebookPosts()[0]!);
  const reel = mapMetricoolPost('instagram', fixtureInstagramReels()[0]!, true);
  it('publicación real (no sintética) con autor y tipo', () => {
    expect(postRow('o', 's', fb)).toMatchObject({
      organization_id: 'o',
      data_source_id: 's',
      external_id: 'fb-5',
      content_type: 'image',
      author_display: 'Marca Sintética',
      is_synthetic: false,
    });
  });
  it('métricas: alcance nulo si la red no lo nombra; reacciones en jsonb', () => {
    const r = snapshotRow('o', 'p', fb, '2026-11-24T00:00:00Z');
    expect(r.reach).toBeNull();
    expect(r.impressions_unique).toBe(5400);
    expect(r.reactions).toEqual({ like: 180, love: 25, wow: 5 });
  });
  it('medios por referencia, sin copia y con retención', () => {
    const [m] = mediaRows('o', 'p', reel, 90, '2026-11-24T00:00:00Z');
    expect(m).toMatchObject({
      kind: 'video',
      copy_allowed: false,
      url_status: 'unknown',
      duration_sec: 42,
      retention_until: '2027-02-22T00:00:00.000Z',
    });
  });
  it('comentario con autor seudonimizado y respuesta enlazada', () => {
    const r = commentRow('o', 's', 'p', {
      externalId: 'c2',
      parentExternalId: 'c1',
      postExternalId: 'x',
      platform: 'instagram',
      body: 'hola',
      authorExternalId: 'hmac',
      authorDisplay: 'u',
      publishedAt: '2026-11-24T00:00:00Z',
      permalink: null,
      contentHash: 'h',
    });
    expect(r).toMatchObject({
      author_hash: 'hmac',
      parent_external_id: 'c1',
      post_id: 'p',
      is_synthetic: false,
    });
  });
  it('estado ↔ columnas: el cursor y los contadores viajan en sync_cursor', () => {
    const prev = initialState({ status: 'connected' });
    const cols = stateToColumns(
      {
        cursor: { postsTo: { instagram: 'T' } },
        itemsDate: '2026-11-24',
        itemsToday: 7,
        lastSyncStatus: 'partial',
      },
      prev,
    );
    expect(cols).toEqual({
      sync_cursor: {
        postsTo: { instagram: 'T' },
        commentsSince: {},
        _items: { date: '2026-11-24', count: 7 },
        _tokenExpirations: {},
        _brand: { pictureUrl: null, accounts: {} },
      },
      last_sync_status: 'partial',
    });
    const back = stateFromRow({
      status: 'connected',
      ingestion_paused: false,
      external_account_ref: '7',
      external_account_label: 'Marca',
      connected_networks: ['instagram'],
      ...cols,
      api_calls_today: 3,
    });
    expect(back).toMatchObject({
      status: 'connected',
      brand: { blogId: '7', label: 'Marca', networks: ['instagram'] },
      itemsToday: 7,
      apiCallsToday: 3,
      cursor: { postsTo: { instagram: 'T' } },
    });
  });
  it('registro de ejecución sin secretos', () => {
    const j = jobRow('o', 's', {
      id: 'r1',
      trigger: 'manual',
      status: 'partial',
      startedAt: 'a',
      finishedAt: 'b',
      postsInserted: 1,
      postsUpdated: 0,
      snapshots: 1,
      commentsInserted: 2,
      duplicates: 1,
      overLimit: 0,
      apiCalls: 5,
      errors: [
        {
          platform: 'facebook',
          dataKind: 'posts',
          kind: 'network',
          message: 'Metricool /v2/analytics/posts/facebook: error de red',
          retryable: true,
        },
      ],
    });
    expect(j).toMatchObject({
      idempotency_key: 'metricool:r1',
      status: 'succeeded',
      items_inserted: 3,
      items_duplicated: 1,
    });
    expect(String(j.error)).not.toMatch(/X-Mc-Auth|token|blogId=/);
  });
});
