import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedComment, NormalizedPost } from '@/lib/connectors/types';
import { authorHash } from '@/lib/security/hash';
import type { Platform } from '@/lib/types';
import {
  commentRow,
  jobRow,
  mediaRows,
  postRow,
  snapshotRow,
  stateFromRow,
  stateToColumns,
} from './supabase-mapping';
import {
  initialState,
  type CoverageCell,
  type SourceSyncState,
  type SyncRun,
  type SyncStore,
} from './types';

/**
 * Persistencia de la sincronización en Supabase (servidor, service role). REQUIERE la migración
 * 0006 (pendiente de GO): sin ella, `metricoolPersistenceReady()` es false y nada se instancia.
 * El cliente service role vive solo aquí (`server-only`); nunca llega al navegador.
 * Los mapeos son funciones puras (supabase-mapping.ts) probadas en tests/sync-mapping.test.ts.
 */
export function metricoolPersistenceReady(): boolean {
  return (
    process.env.HF_MIGRATION_0006_APPLIED === 'true' &&
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.HF_SUPABASE_SERVICE_ROLE_KEY &&
      process.env.HF_AUTHOR_HASH_SALT,
    )
  );
}

type Row = Record<string, unknown>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export class SupabaseSyncStore implements SyncStore {
  private readonly db: SupabaseClient;
  private readonly sourceIds = new Map<string, string>();

  constructor(
    private readonly salt = process.env.HF_AUTHOR_HASH_SALT!,
    private readonly retentionDays = 90,
  ) {
    this.db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.HF_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }

  private async source(orgId: string): Promise<Row | null> {
    const { data, error } = await this.db
      .from('data_sources')
      .select('*')
      .eq('organization_id', orgId)
      .eq('provider', 'metricool')
      .maybeSingle();
    fail(error);
    if (data) this.sourceIds.set(orgId, String((data as Row).id));
    return (data as Row) ?? null;
  }
  private async sourceId(orgId: string) {
    const id =
      this.sourceIds.get(orgId) ?? String((await this.source(orgId))?.id ?? '');
    if (!id) throw new Error('La organización no tiene fuente Metricool');
    return id;
  }

  authorKey(orgId: string, platform: Platform, author: string | null) {
    return author ? authorHash(orgId, platform, author, this.salt) : null;
  }

  async load(orgId: string) {
    const r = await this.source(orgId);
    return r ? stateFromRow(r) : null;
  }

  async save(orgId: string, patch: Partial<SourceSyncState>) {
    const prev = (await this.load(orgId)) ?? initialState();
    const { error } = await this.db
      .from('data_sources')
      .update(stateToColumns(patch, prev))
      .eq('organization_id', orgId)
      .eq('provider', 'metricool');
    fail(error);
  }

  async upsertPosts(orgId: string, posts: NormalizedPost[], at: string) {
    if (!posts.length) return { inserted: 0, updated: 0, snapshots: 0 };
    const sid = await this.sourceId(orgId);
    const { data: before } = await this.db
      .from('social_posts')
      .select('external_id')
      .eq('data_source_id', sid)
      .in(
        'external_id',
        posts.map((p) => p.externalId),
      );
    const known = new Set(
      (before ?? []).map((r) => String((r as Row).external_id)),
    );
    const { data, error } = await this.db
      .from('social_posts')
      .upsert(
        posts.map((p) => postRow(orgId, sid, p)),
        { onConflict: 'organization_id,data_source_id,external_id' },
      )
      .select('id, external_id');
    fail(error);
    const ids = new Map(
      (data ?? []).map((r) => [
        String((r as Row).external_id),
        String((r as Row).id),
      ]),
    );
    const snaps = posts.flatMap((p) =>
      ids.get(p.externalId)
        ? [snapshotRow(orgId, ids.get(p.externalId)!, p, at)]
        : [],
    );
    fail((await this.db.from('post_metric_snapshots').insert(snaps)).error);
    const media = posts.flatMap((p) =>
      ids.get(p.externalId)
        ? mediaRows(orgId, ids.get(p.externalId)!, p, this.retentionDays, at)
        : [],
    );
    if (media.length)
      fail(
        (
          await this.db
            .from('post_media')
            .upsert(media, { onConflict: 'post_id,position' })
        ).error,
      );
    const inserted = posts.filter((p) => !known.has(p.externalId)).length;
    return {
      inserted,
      updated: posts.length - inserted,
      snapshots: snaps.length,
    };
  }

  async enrichPostMedia(
    orgId: string,
    platform: Platform,
    media: Map<string, string[]>,
  ) {
    if (!media.size) return 0;
    const sid = await this.sourceId(orgId);
    const { data } = await this.db
      .from('social_posts')
      .select('id, external_id')
      .eq('data_source_id', sid)
      .eq('platform', platform)
      .in('external_id', [...media.keys()]);
    let n = 0;
    for (const r of (data ?? []) as Row[]) {
      const urls = media.get(String(r.external_id)) ?? [];
      const { count } = await this.db
        .from('post_media')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', String(r.id));
      if (urls.length <= (count ?? 0)) continue;
      const rows = mediaRows(
        orgId,
        String(r.id),
        {
          media: urls.map((u) => ({ kind: 'image' as const, sourceUrl: u })),
        } as NormalizedPost,
        this.retentionDays,
        new Date().toISOString(),
      );
      fail(
        (
          await this.db
            .from('post_media')
            .upsert(rows, { onConflict: 'post_id,position' })
        ).error,
      );
      if (urls.length > 1)
        await this.db
          .from('social_posts')
          .update({
            content_type: 'carousel',
            media_count_reported: urls.length,
          })
          .eq('id', String(r.id));
      n++;
    }
    return n;
  }

  async knownComments(orgId: string) {
    const sid = await this.sourceId(orgId);
    const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const { data, error } = await this.db
      .from('social_comments')
      .select('external_id, author_hash, content_hash')
      .eq('data_source_id', sid)
      .gte('published_at', since)
      .limit(20000);
    fail(error);
    const ids = new Set<string>();
    const authorHashes = new Set<string>();
    for (const r of (data ?? []) as Row[]) {
      ids.add(String(r.external_id));
      authorHashes.add(`${r.author_hash ?? 'anon'}:${r.content_hash}`);
    }
    return { ids, authorHashes };
  }

  async insertComments(
    orgId: string,
    comments: Array<NormalizedComment & { contentHash: string }>,
  ) {
    if (!comments.length) return 0;
    const sid = await this.sourceId(orgId);
    const postExt = [
      ...new Set(comments.map((c) => c.postExternalId).filter(Boolean)),
    ] as string[];
    const { data: posts } = await this.db
      .from('social_posts')
      .select('id, external_id')
      .eq('data_source_id', sid)
      .in('external_id', postExt);
    const pid = new Map(
      ((posts ?? []) as Row[]).map((r) => [
        String(r.external_id),
        String(r.id),
      ]),
    );
    const { data, error } = await this.db
      .from('social_comments')
      .upsert(
        comments.map((c) =>
          commentRow(
            orgId,
            sid,
            c.postExternalId ? (pid.get(c.postExternalId) ?? null) : null,
            c,
          ),
        ),
        {
          onConflict: 'organization_id,data_source_id,external_id',
          ignoreDuplicates: true,
        },
      )
      .select('id');
    fail(error);
    return (data ?? []).length;
  }

  async replaceCoverage(orgId: string, cells: CoverageCell[]) {
    const sid = await this.sourceId(orgId);
    fail(
      (await this.db.from('source_coverage').delete().eq('data_source_id', sid))
        .error,
    );
    const now = new Date().toISOString();
    if (cells.length)
      fail(
        (
          await this.db.from('source_coverage').insert(
            cells.map((c) => ({
              organization_id: orgId,
              data_source_id: sid,
              platform: c.platform,
              data_kind: c.dataKind,
              status: c.status,
              reason: c.reason,
              period_start: now,
              items_ingested: c.items,
              last_success_at:
                c.status === 'complete' || c.status === 'partial' ? now : null,
            })),
          )
        ).error,
      );
  }

  async recordRun(orgId: string, run: SyncRun) {
    const sid = await this.sourceId(orgId);
    fail(
      (await this.db.from('ingestion_jobs').insert(jobRow(orgId, sid, run)))
        .error,
    );
  }

  async runs(orgId: string, limit = 10): Promise<SyncRun[]> {
    const sid = await this.sourceId(orgId);
    const { data } = await this.db
      .from('ingestion_jobs')
      .select('*')
      .eq('data_source_id', sid)
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data ?? []) as Row[]).map((r) => {
      const e = r.error
        ? (JSON.parse(String(r.error)) as Partial<SyncRun>)
        : {};
      return {
        id: String(r.idempotency_key),
        trigger: e.trigger ?? 'manual',
        status: (e.status ?? r.status) as SyncRun['status'],
        startedAt: String(r.started_at),
        finishedAt: String(r.finished_at),
        postsInserted: 0,
        postsUpdated: 0,
        snapshots: 0,
        commentsInserted: Number(r.items_inserted ?? 0),
        duplicates: Number(r.items_duplicated ?? 0),
        overLimit: 0,
        apiCalls: e.apiCalls ?? 0,
        errors: e.errors ?? [],
      };
    });
  }

  async counts(orgId: string) {
    const sid = await this.sourceId(orgId);
    const c = async (t: string) =>
      (
        await this.db
          .from(t)
          .select('id', { count: 'exact', head: true })
          .eq('data_source_id', sid)
      ).count ?? 0;
    return {
      posts: await c('social_posts'),
      comments: await c('social_comments'),
      snapshots: 0,
    };
  }

  async coverage(orgId: string): Promise<CoverageCell[]> {
    const sid = await this.sourceId(orgId);
    const { data } = await this.db
      .from('source_coverage')
      .select('*')
      .eq('data_source_id', sid);
    return ((data ?? []) as Row[]).map((r) => ({
      platform: r.platform as Platform,
      dataKind: r.data_kind as CoverageCell['dataKind'],
      status: r.status as CoverageCell['status'],
      reason: String(r.reason ?? ''),
      items: Number(r.items_ingested ?? 0),
    }));
  }

  async posts() {
    return [];
  }
}

/** Organizaciones con Metricool conectado y sin pausa (para la tarea programada). */
export async function connectedMetricoolOrgs(): Promise<string[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.HF_SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db
    .from('data_sources')
    .select('organization_id')
    .eq('provider', 'metricool')
    .eq('status', 'connected')
    .eq('ingestion_paused', false);
  fail(error);
  return ((data ?? []) as Row[]).map((r) => String(r.organization_id));
}
