import type { NormalizedComment, NormalizedPost } from '@/lib/connectors/types';
import type { Platform } from '@/lib/types';
import {
  initialState,
  type ConnectionStatus,
  type SourceSyncState,
  type SyncRun,
} from './types';

/** Mapeos puros entre el estado de sincronización y las tablas de 0006 (sin red ni base). */
type Row = Record<string, unknown>;

const STATUS_IN: Record<string, ConnectionStatus> = {
  connected: 'connected',
  error: 'error',
  insufficient_permissions: 'insufficient_permissions',
  not_connected: 'not_connected',
  pending_authorization: 'not_connected',
  disabled: 'disconnected',
};
const STATUS_OUT: Record<ConnectionStatus, string> = {
  connected: 'connected',
  error: 'error',
  insufficient_permissions: 'insufficient_permissions',
  not_connected: 'not_connected',
  disconnected: 'disabled',
};

export function stateFromRow(r: Row): SourceSyncState {
  const cur = (r.sync_cursor ?? {}) as Row;
  const items = (cur._items ?? {}) as { date?: string; count?: number };
  return initialState({
    status: STATUS_IN[String(r.status)] ?? 'not_connected',
    statusReason: (r.status_reason as string) ?? null,
    paused: Boolean(r.ingestion_paused),
    brand: r.external_account_ref
      ? {
          blogId: String(r.external_account_ref),
          label: String(r.external_account_label ?? r.external_account_ref),
          networks: (r.connected_networks as Platform[]) ?? [],
          tokenExpirations:
            (cur._tokenExpirations as Partial<Record<Platform, string>>) ?? {},
        }
      : null,
    cursor: {
      postsTo: cur.postsTo as never,
      commentsSince: cur.commentsSince as never,
    },
    apiCallsDate: (r.api_calls_date as string) ?? null,
    apiCallsToday: Number(r.api_calls_today ?? 0),
    maxApiCallsPerDay: Number(r.max_api_calls_per_day ?? 500),
    itemsDate: items.date ?? null,
    itemsToday: items.count ?? 0,
    maxItemsPerDay: Number(r.max_items_per_day ?? 5000),
    consecutiveFailures: Number(r.consecutive_failures ?? 0),
    lastSyncStartedAt: (r.last_sync_started_at as string) ?? null,
    lastSyncFinishedAt: (r.last_sync_finished_at as string) ?? null,
    lastSyncStatus:
      (r.last_sync_status as SourceSyncState['lastSyncStatus']) ?? null,
    lastSyncError: (r.last_sync_error as string) ?? null,
  });
}

/** Columnas a escribir para un cambio de estado (merge del cursor en `sync_cursor`). */
export function stateToColumns(
  patch: Partial<SourceSyncState>,
  prev: SourceSyncState,
): Row {
  const next = { ...prev, ...patch };
  const out: Row = {};
  if ('status' in patch) out.status = STATUS_OUT[next.status];
  if ('statusReason' in patch) out.status_reason = next.statusReason;
  if ('paused' in patch) out.ingestion_paused = next.paused;
  if ('brand' in patch) {
    out.external_account_ref = next.brand?.blogId ?? null;
    out.external_account_label = next.brand?.label ?? null;
    out.connected_networks = next.brand?.networks ?? [];
  }
  if (
    'cursor' in patch ||
    'itemsDate' in patch ||
    'itemsToday' in patch ||
    'brand' in patch
  )
    out.sync_cursor = {
      postsTo: next.cursor.postsTo ?? {},
      commentsSince: next.cursor.commentsSince ?? {},
      _items: { date: next.itemsDate, count: next.itemsToday },
      _tokenExpirations: next.brand?.tokenExpirations ?? {},
    };
  if ('apiCallsDate' in patch) out.api_calls_date = next.apiCallsDate;
  if ('apiCallsToday' in patch) out.api_calls_today = next.apiCallsToday;
  if ('maxApiCallsPerDay' in patch)
    out.max_api_calls_per_day = next.maxApiCallsPerDay;
  if ('maxItemsPerDay' in patch) out.max_items_per_day = next.maxItemsPerDay;
  if ('consecutiveFailures' in patch)
    out.consecutive_failures = next.consecutiveFailures;
  if ('lastSyncStartedAt' in patch)
    out.last_sync_started_at = next.lastSyncStartedAt;
  if ('lastSyncFinishedAt' in patch)
    out.last_sync_finished_at = next.lastSyncFinishedAt;
  if ('lastSyncStatus' in patch)
    out.last_sync_status =
      next.lastSyncStatus === 'skipped_not_connected'
        ? 'failed'
        : next.lastSyncStatus;
  if ('lastSyncError' in patch)
    out.last_sync_error = next.lastSyncError?.slice(0, 500) ?? null;
  return out;
}

export function postRow(
  orgId: string,
  sourceId: string,
  p: NormalizedPost,
): Row {
  return {
    organization_id: orgId,
    data_source_id: sourceId,
    platform: p.platform,
    external_id: p.externalId,
    permalink: p.permalink,
    body: p.body,
    published_at: p.publishedAt,
    content_type: p.contentType ?? 'unknown',
    title: p.title ?? null,
    author_display: p.author?.display ?? null,
    author_handle: p.author?.handle ?? null,
    author_avatar_url: p.author?.avatarUrl ?? null,
    media_count_reported: p.mediaCountReported ?? null,
    is_synthetic: false,
  };
}

export function snapshotRow(
  orgId: string,
  postId: string,
  p: NormalizedPost,
  at: string,
): Row {
  const m = p.metrics;
  return {
    organization_id: orgId,
    post_id: postId,
    captured_at: at,
    likes: m.likes ?? null,
    comments: m.comments ?? null,
    shares: m.shares ?? null,
    views: m.views ?? null,
    reach: m.reach ?? null,
    impressions: m.impressions ?? null,
    impressions_unique: m.impressionsUnique ?? null,
    interactions: m.interactions ?? null,
    saves: m.saves ?? null,
    video_views: m.videoViews ?? null,
    engagement: m.engagement ?? null,
    reactions: m.reactions ?? null,
    is_synthetic: false,
  };
}

/** Medios por referencia (arquitectura híbrida: la copia de miniaturas es un paso aparte). */
export function mediaRows(
  orgId: string,
  postId: string,
  p: NormalizedPost,
  retentionDays: number,
  at: string,
): Row[] {
  const until = new Date(
    Date.parse(at) + retentionDays * 86_400_000,
  ).toISOString();
  return (p.media ?? []).slice(0, 100).map((m, i) => ({
    organization_id: orgId,
    post_id: postId,
    position: i,
    kind: m.kind,
    source_url: m.sourceUrl,
    preview_url: m.previewUrl ?? null,
    duration_sec: m.durationSec ?? null,
    copy_allowed: false,
    url_status: 'unknown',
    retention_until: until,
  }));
}

export function commentRow(
  orgId: string,
  sourceId: string,
  postId: string | null,
  c: NormalizedComment & { contentHash: string },
): Row {
  return {
    organization_id: orgId,
    data_source_id: sourceId,
    post_id: postId,
    platform: c.platform,
    external_id: c.externalId,
    parent_external_id: c.parentExternalId,
    body: c.body,
    author_hash: c.authorExternalId, // ya seudonimizado por authorKey()
    author_display: c.authorDisplay,
    published_at: c.publishedAt,
    permalink: c.permalink,
    content_hash: c.contentHash,
    media_url: c.mediaUrl ?? null,
    is_synthetic: false,
  };
}

const JOB_STATUS: Record<SyncRun['status'], string> = {
  succeeded: 'succeeded',
  partial: 'succeeded',
  failed: 'failed',
  skipped_budget: 'skipped_budget',
  skipped_paused: 'skipped_paused',
  skipped_kill_switch: 'skipped_paused',
  skipped_not_connected: 'skipped_paused',
};

export function jobRow(orgId: string, sourceId: string, r: SyncRun): Row {
  return {
    organization_id: orgId,
    data_source_id: sourceId,
    data_kind: 'posts',
    idempotency_key: `metricool:${r.id}`,
    status: JOB_STATUS[r.status],
    items_fetched:
      r.postsInserted + r.postsUpdated + r.commentsInserted + r.duplicates,
    items_inserted: r.postsInserted + r.commentsInserted,
    items_duplicated: r.duplicates,
    // Solo mensajes (sin tokens ni URLs completas: el conector ya los excluye).
    error: r.errors.length
      ? JSON.stringify({
          status: r.status,
          trigger: r.trigger,
          apiCalls: r.apiCalls,
          errors: r.errors,
        }).slice(0, 4000)
      : null,
    started_at: r.startedAt,
    finished_at: r.finishedAt,
  };
}
