import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import type {
  Alert,
  Analysis,
  ConversationItem,
  CoverageRow,
  DailyReport,
  DataSource,
  Incident,
  IncidentStatus,
  Member,
  Post,
} from '@/lib/types';
import type { WaDispatch, WaRecipient } from '@/lib/whatsapp/notifier';
import type {
  ItemFilters,
  Membership,
  PostFilters,
  Repository,
  UsageSummary,
  Viewer,
} from './repository';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const POST_COLUMNS =
  'id, organization_id, platform, body, permalink, published_at, is_synthetic, social_accounts(handle), post_metric_snapshots(captured_at, likes, comments, shares, views, reach)';

function toPost(r: Row): Post {
  return {
    id: r.id,
    organizationId: r.organization_id,
    platform: r.platform,
    accountHandle: r.social_accounts?.handle ?? null,
    body: r.body,
    permalink: r.permalink,
    publishedAt: r.published_at,
    isSynthetic: r.is_synthetic,
    metrics: ((r.post_metric_snapshots ?? []) as Row[])
      .map((m) => ({
        capturedAt: m.captured_at,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        views: m.views,
        reach: m.reach,
      }))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
  };
}

function toAnalysis(r: Row | undefined): Analysis | null {
  if (!r) return null;
  return {
    sentiment: r.sentiment,
    intent: r.intent,
    topics: r.topics ?? [],
    severity: r.severity,
    confidence: Number(r.confidence),
    explanation: r.explanation,
    priorityScore: Number(r.priority_score),
    layer: r.layer,
    reviewStatus: r.review_status,
    provider: r.provider,
    model: r.model,
  };
}

/**
 * Implementación Supabase. Usa SIEMPRE la sesión del usuario (nunca service
 * role): la autorización la decide RLS. organizationId se filtra además de
 * forma explícita para que las consultas sean acotadas y auditables.
 */
export class SupabaseRepository implements Repository {
  async memberships(viewer: Viewer): Promise<Membership[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('memberships')
      .select('role, organizations(id, name, slug, is_demo, retention_days)')
      .eq('user_id', viewer.userId);
    fail(error);
    return (data ?? []).map((m: Row) => ({
      role: m.role,
      organization: {
        id: m.organizations.id,
        name: m.organizations.name,
        slug: m.organizations.slug,
        isDemo: m.organizations.is_demo,
        retentionDays: m.organizations.retention_days,
      },
    }));
  }

  async items(orgId: string, f: ItemFilters = {}): Promise<ConversationItem[]> {
    const db = await supabaseServer();
    let q = db
      .from('social_comments')
      .select(
        'id, organization_id, post_id, platform, body, author_display, published_at, is_synthetic, brands(name), data_sources(provider)',
      )
      .eq('organization_id', orgId)
      .is('deleted_at_source', null)
      .order('published_at', { ascending: false })
      .limit(f.limit ?? 200);
    if (f.platform) q = q.eq('platform', f.platform);
    if (f.postId) q = q.eq('post_id', f.postId);
    if (f.q) q = q.ilike('body', `%${f.q.replace(/[%_]/g, '')}%`);
    const { data, error } = await q;
    fail(error);
    const rows = (data ?? []) as Row[];
    const ids = rows.map((r) => r.id);
    const analyses = new Map<string, Row>();
    if (ids.length) {
      const res = await db
        .from('sentiment_analyses')
        .select('*')
        .eq('organization_id', orgId)
        .eq('item_type', 'comment')
        .in('item_id', ids)
        .order('created_at', { ascending: false });
      fail(res.error);
      for (const a of (res.data ?? []) as Row[])
        if (!analyses.has(a.item_id)) analyses.set(a.item_id, a);
    }
    return rows
      .map((r) => ({
        id: r.id,
        organizationId: r.organization_id,
        kind: 'comment' as const,
        platform: r.platform,
        provider: r.data_sources?.provider ?? 'demo',
        brand: r.brands?.name ?? null,
        body: r.body,
        authorDisplay: r.author_display,
        publishedAt: r.published_at,
        permalink: null,
        isSynthetic: r.is_synthetic,
        analysis: toAnalysis(analyses.get(r.id)),
        postId: r.post_id ?? null,
      }))
      .filter((i) => !f.sentiment || i.analysis?.sentiment === f.sentiment)
      .filter((i) => !f.severity || i.analysis?.severity === f.severity)
      .filter((i) => !f.layer || i.analysis?.layer === f.layer)
      .filter(
        (i) => !f.reviewPending || i.analysis?.reviewStatus === 'pending',
      );
  }

  async alerts(orgId: string): Promise<Alert[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('alerts')
      .select('*, incidents(id)')
      .eq('organization_id', orgId)
      .order('priority_score', { ascending: false })
      .limit(200);
    fail(error);
    return ((data ?? []) as Row[]).map((a) => ({
      id: a.id,
      organizationId: a.organization_id,
      title: a.title,
      summary: a.summary,
      severity: a.severity,
      priorityScore: Number(a.priority_score),
      reviewStatus: a.review_status,
      createdAt: a.created_at,
      isSynthetic: a.is_synthetic,
      itemIds: [],
      incidentId: a.incidents?.[0]?.id ?? null,
    }));
  }

  async reviewAlert(
    orgId: string,
    alertId: string,
    decision: 'confirmed' | 'dismissed',
    viewer: Viewer,
  ) {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('alerts')
      .update({
        review_status: decision,
        reviewed_by: viewer.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('organization_id', orgId)
      .eq('id', alertId)
      .select('id');
    fail(error);
    if (!data?.length) throw new Error('Sin permiso o alerta inexistente');
  }

  async incidents(orgId: string): Promise<Incident[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('incidents')
      .select('*')
      .eq('organization_id', orgId)
      .order('opened_at', { ascending: false })
      .limit(200);
    fail(error);
    return ((data ?? []) as Row[]).map((r) => this.mapIncident(r, []));
  }

  private mapIncident(r: Row, events: Row[]): Incident {
    return {
      id: r.id,
      organizationId: r.organization_id,
      alertId: r.alert_id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      owner: r.owner_user_id,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      resolutionSummary: r.resolution_summary,
      isSynthetic: r.is_synthetic,
      events: events.map((e) => ({
        id: String(e.id),
        kind: e.kind,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        body: e.body,
        actor: e.actor_user_id,
        createdAt: e.created_at,
      })),
    };
  }

  async incident(orgId: string, id: string) {
    const db = await supabaseServer();
    const [inc, ev] = await Promise.all([
      db
        .from('incidents')
        .select('*')
        .eq('organization_id', orgId)
        .eq('id', id)
        .maybeSingle(),
      db
        .from('incident_events')
        .select('*')
        .eq('organization_id', orgId)
        .eq('incident_id', id)
        .order('created_at'),
    ]);
    fail(inc.error);
    fail(ev.error);
    return inc.data
      ? this.mapIncident(inc.data as Row, (ev.data ?? []) as Row[])
      : null;
  }

  async openIncidentFromAlert(orgId: string, alertId: string, viewer: Viewer) {
    const db = await supabaseServer();
    const { data: alert, error } = await db
      .from('alerts')
      .select('id, title, severity, review_status')
      .eq('organization_id', orgId)
      .eq('id', alertId)
      .maybeSingle();
    fail(error);
    if (!alert) throw new Error('Alerta no encontrada');
    if (alert.severity === 'critical' && alert.review_status !== 'confirmed') {
      throw new Error(
        'Una alerta crítica requiere revisión humana antes de abrir incidente',
      );
    }
    const ins = await db
      .from('incidents')
      .insert({
        organization_id: orgId,
        alert_id: alertId,
        title: alert.title,
        severity: alert.severity,
        opened_by: viewer.userId,
      })
      .select('id')
      .single();
    fail(ins.error);
    return (ins.data as Row).id as string;
  }

  async transitionIncident(
    orgId: string,
    id: string,
    to: IncidentStatus,
    _viewer: Viewer,
    resolution?: string,
  ) {
    const db = await supabaseServer();
    const patch: Row = { status: to };
    if (resolution) patch.resolution_summary = resolution;
    const { data, error } = await db
      .from('incidents')
      .update(patch)
      .eq('organization_id', orgId)
      .eq('id', id)
      .select('id');
    fail(error);
    if (!data?.length) throw new Error('Sin permiso o incidente inexistente');
  }

  async assignIncident(orgId: string, id: string, ownerUserId: string) {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('incidents')
      .update({ owner_user_id: ownerUserId })
      .eq('organization_id', orgId)
      .eq('id', id)
      .select('id');
    fail(error);
    if (!data?.length) throw new Error('Sin permiso o incidente inexistente');
  }

  async addIncidentNote(
    orgId: string,
    id: string,
    body: string,
    viewer: Viewer,
  ) {
    const db = await supabaseServer();
    const { error } = await db.from('incident_events').insert({
      organization_id: orgId,
      incident_id: id,
      actor_user_id: viewer.userId,
      kind: 'note',
      body: body.slice(0, 2000),
    });
    fail(error);
  }

  async sources(orgId: string): Promise<DataSource[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('data_sources')
      .select('*')
      .eq('organization_id', orgId);
    fail(error);
    return ((data ?? []) as Row[]).map((s) => ({
      id: s.id,
      organizationId: s.organization_id,
      provider: s.provider,
      displayName: s.display_name,
      status: s.status,
      statusReason: s.status_reason,
      ingestionPaused: s.ingestion_paused,
      maxItemsPerDay: s.max_items_per_day,
    }));
  }

  async coverage(orgId: string): Promise<CoverageRow[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('source_coverage')
      .select('*, data_sources(provider), social_accounts(handle)')
      .eq('organization_id', orgId);
    fail(error);
    return ((data ?? []) as Row[]).map((c) => ({
      id: c.id,
      organizationId: c.organization_id,
      dataSourceId: c.data_source_id,
      provider: c.data_sources?.provider,
      platform: c.platform,
      dataKind: c.data_kind,
      status: c.status,
      reason: c.reason,
      accountHandle: c.social_accounts?.handle ?? null,
      periodStart: c.period_start,
      periodEnd: c.period_end,
      itemsIngested: c.items_ingested,
    }));
  }

  async members(orgId: string): Promise<Member[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('memberships')
      .select('user_id, role, display_name')
      .eq('organization_id', orgId)
      .order('display_name');
    fail(error);
    return ((data ?? []) as Row[]).map((m) => ({
      userId: m.user_id,
      // auth.users no es legible desde la sesión: el nombre vive en memberships (0005).
      name: m.display_name ?? `Miembro ${String(m.user_id).slice(0, 8)}`,
      email: '',
      role: m.role,
    }));
  }

  async usage(orgId: string): Promise<UsageSummary> {
    const db = await supabaseServer();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [b, u] = await Promise.all([
      db
        .from('usage_budgets')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle(),
      db
        .from('ai_usage')
        .select('cost_usd, cache_hit, created_at, provider, model')
        .eq('organization_id', orgId)
        .gte('created_at', monthStart.toISOString()),
    ]);
    const rows = (u.data ?? []) as Row[];
    const today = new Date().toISOString().slice(0, 10);
    return {
      aiMonthlyUsdLimit: Number(b.data?.ai_monthly_usd ?? 30),
      aiMonthlyUsdSpent: rows.reduce((s, r) => s + Number(r.cost_usd), 0),
      aiDailyItemsLimit: Number(b.data?.ai_daily_items ?? 2000),
      aiDailyItemsUsed: rows.filter(
        (r) => !r.cache_hit && String(r.created_at).startsWith(today),
      ).length,
      cacheHits: rows.filter((r) => r.cache_hit).length,
      whatsappMonthlyUsdLimit: Number(b.data?.whatsapp_monthly_usd ?? 5),
      provider:
        rows.at(-1)?.provider ?? process.env.HF_AI_PROVIDER ?? 'heuristic',
      model: rows.at(-1)?.model ?? '—',
    };
  }

  async waRecipients(orgId: string): Promise<WaRecipient[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('whatsapp_recipients')
      .select('*')
      .eq('organization_id', orgId);
    fail(error);
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      phoneE164: r.phone_e164,
      minSeverity: r.min_severity,
      optedInAt: r.opted_in_at,
      optedOutAt: r.opted_out_at,
      isActive: r.is_active,
    }));
  }

  async waDispatches(orgId: string): Promise<WaDispatch[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('notification_deliveries')
      .select('*')
      .eq('organization_id', orgId)
      .eq('channel', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(50);
    fail(error);
    return ((data ?? []) as Row[]).map((d) => ({
      recipientId: d.recipient_id,
      template: d.template_name,
      preview: '',
      status: d.status,
      reason: d.error ?? d.mode,
      idempotencyKey: d.idempotency_key,
    }));
  }

  async posts(orgId: string, f: PostFilters = {}): Promise<Post[]> {
    const db = await supabaseServer();
    let q = db
      .from('social_posts')
      .select(POST_COLUMNS)
      .eq('organization_id', orgId)
      .is('deleted_at_source', null)
      .order('published_at', { ascending: false })
      .limit(f.limit ?? 100);
    if (f.platform) q = q.eq('platform', f.platform);
    if (f.q) q = q.ilike('body', `%${f.q.replace(/[%_]/g, '')}%`);
    const { data, error } = await q;
    fail(error);
    return ((data ?? []) as Row[]).map(toPost);
  }

  async post(orgId: string, id: string): Promise<Post | null> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('social_posts')
      .select(POST_COLUMNS)
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle();
    fail(error);
    return data ? toPost(data as Row) : null;
  }

  async reports(orgId: string): Promise<DailyReport[]> {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('daily_reports')
      .select(
        'id, organization_id, report_date, summary, coverage_note, metrics, is_synthetic',
      )
      .eq('organization_id', orgId)
      .order('report_date', { ascending: false })
      .limit(30);
    fail(error);
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      reportDate: r.report_date,
      summary: r.summary,
      coverageNote: r.coverage_note,
      metrics: (r.metrics ?? {}) as Record<string, number>,
      isSynthetic: r.is_synthetic,
    }));
  }
}
