import { HeuristicProvider } from '@/lib/ai/providers';
import { analyzeItem, type AnalysisCache } from '@/lib/ai/router';
import { canTransition, requiresResolutionSummary } from '@/lib/incidents/fsm';
import {
  DEMO_COMMENTS,
  DEMO_ORGS,
  DEMO_SOURCES,
  DEMO_USERS,
} from '@/lib/demo/seed';
import {
  planDispatch,
  type WaDispatch,
  type WaRecipient,
} from '@/lib/whatsapp/notifier';
import type {
  Alert,
  Analysis,
  ConversationItem,
  CoverageRow,
  DataSource,
  Incident,
  IncidentStatus,
  Platform,
} from '@/lib/types';
import type {
  ItemFilters,
  Membership,
  Repository,
  UsageSummary,
  Viewer,
} from './repository';

/**
 * Repositorio en memoria para MODO DEMOSTRACIÓN. Todos los datos son
 * ficticios (is_synthetic = true). Los cambios viven en memoria del proceso.
 */
interface OrgStore {
  items: ConversationItem[];
  alerts: Alert[];
  incidents: Incident[];
  sources: DataSource[];
  coverage: CoverageRow[];
  recipients: WaRecipient[];
  dispatches: WaDispatch[];
  cacheHits: number;
  aiItems: number;
}

let storePromise: Promise<Map<string, OrgStore>> | null = null;
const uid = () => crypto.randomUUID();

async function buildStore(): Promise<Map<string, OrgStore>> {
  const now = Date.now();
  const provider = new HeuristicProvider();
  const cache = new Map<string, Analysis>();
  const map = new Map<string, OrgStore>();
  for (const org of DEMO_ORGS) {
    const st: OrgStore = {
      items: [],
      alerts: [],
      incidents: [],
      sources: [],
      coverage: [],
      recipients: [],
      dispatches: [],
      cacheHits: 0,
      aiItems: 0,
    };
    const memCache: AnalysisCache = {
      get: async (k) => cache.get(`${org.id}:${k}`) ?? null,
      set: async (k, v) => void cache.set(`${org.id}:${k}`, v),
    };
    for (const [i, s] of (DEMO_COMMENTS[org.id] ?? []).entries()) {
      const { analysis, decision } = await analyzeItem(
        {
          organizationId: org.id,
          text: s.text,
          platform: s.platform,
          brand: org.brand,
        },
        {
          provider,
          cache: memCache,
          budget: {
            monthlyUsdLimit: 30,
            monthlyUsdSpent: 0,
            dailyItemsLimit: 2000,
            dailyItemsUsed: i,
            hardStop: true,
          },
          usage: { record: async () => {} },
          ctx: { volumeRatio: /app|aplicaci/i.test(s.text) ? 3 : 1 },
        },
      );
      if (decision === 'cache') st.cacheHits++;
      else st.aiItems++;
      st.items.push({
        id: `${org.slug}-c${i + 1}`,
        organizationId: org.id,
        kind: 'comment',
        platform: s.platform,
        provider: 'demo',
        brand: org.brand,
        body: s.text,
        authorDisplay: s.author,
        publishedAt: new Date(now - s.h * 3600_000).toISOString(),
        permalink: null,
        isSynthetic: true,
        analysis,
      });
    }

    // Alertas: items de prioridad alta + un clúster de volumen (app caída).
    for (const it of st.items) {
      const a = it.analysis;
      if (!a || a.priorityScore < 60) continue;
      st.alerts.push({
        id: `${it.id}-alert`,
        organizationId: org.id,
        title:
          a.severity === 'critical'
            ? `Señal crítica: ${a.topics[0] ?? 'riesgo reputacional'}`
            : `Prioridad alta: ${a.topics[0] ?? 'conversación negativa'}`,
        summary: `${it.platform}: “${it.body.slice(0, 140)}”. ${a.explanation}`,
        severity:
          a.severity === 'critical' || a.priorityScore >= 80
            ? 'critical'
            : 'high',
        priorityScore: a.priorityScore,
        reviewStatus:
          a.severity === 'critical' || a.priorityScore >= 80
            ? 'pending'
            : 'not_required',
        createdAt: it.publishedAt,
        isSynthetic: true,
        itemIds: [it.id],
        incidentId: null,
      });
    }
    const appItems = st.items.filter(
      (i) =>
        /app|aplicaci/i.test(i.body) && i.analysis?.sentiment !== 'positive',
    );
    if (appItems.length >= 2) {
      st.alerts.push({
        id: `${org.slug}-cluster-app`,
        organizationId: org.id,
        title: 'Pico de conversación: fallas en canales digitales',
        summary: `${appItems.length} menciones en pocas horas sobre la app (≈3× la línea base). Posible caída del servicio.`,
        severity: 'high',
        priorityScore: 74,
        reviewStatus: 'not_required',
        createdAt: appItems[0]!.publishedAt,
        isSynthetic: true,
        itemIds: appItems.map((i) => i.id),
        incidentId: null,
      });
    }
    st.alerts.sort((a, b) => b.priorityScore - a.priorityScore);

    // Incidente de ejemplo con historial.
    const first = st.alerts.find((a) => a.severity === 'critical');
    if (first) {
      const id = `${org.slug}-inc-1`;
      first.reviewStatus = 'confirmed';
      first.incidentId = id;
      const t0 = Date.parse(first.createdAt);
      st.incidents.push({
        id,
        organizationId: org.id,
        alertId: first.id,
        title: first.title,
        severity: 'critical',
        status: 'investigating',
        owner:
          org.id === DEMO_ORGS[0].id ? 'demo-user-responder' : 'demo-user-bank',
        openedAt: new Date(t0 + 10 * 60_000).toISOString(),
        closedAt: null,
        resolutionSummary: null,
        isSynthetic: true,
        events: [
          {
            id: uid(),
            kind: 'opened',
            fromStatus: null,
            toStatus: 'open',
            body: first.title,
            actor: 'demo-user-analyst',
            createdAt: new Date(t0 + 10 * 60_000).toISOString(),
          },
          {
            id: uid(),
            kind: 'assigned',
            fromStatus: null,
            toStatus: null,
            body: 'Asignado a responsable de turno',
            actor: 'demo-user-analyst',
            createdAt: new Date(t0 + 12 * 60_000).toISOString(),
          },
          {
            id: uid(),
            kind: 'status_changed',
            fromStatus: 'open',
            toStatus: 'acknowledged',
            body: null,
            actor: 'demo-user-responder',
            createdAt: new Date(t0 + 15 * 60_000).toISOString(),
          },
          {
            id: uid(),
            kind: 'notified',
            fromStatus: null,
            toStatus: null,
            body: 'WhatsApp SIMULADO: hf_alerta_critica a 1 destinatario',
            actor: null,
            createdAt: new Date(t0 + 16 * 60_000).toISOString(),
          },
          {
            id: uid(),
            kind: 'status_changed',
            fromStatus: 'acknowledged',
            toStatus: 'investigating',
            body: null,
            actor: 'demo-user-responder',
            createdAt: new Date(t0 + 25 * 60_000).toISOString(),
          },
        ],
      });
    }

    st.sources = DEMO_SOURCES.map((s) => ({
      id: `${org.slug}-src-${s.provider}`,
      organizationId: org.id,
      provider: s.provider,
      displayName: s.provider === 'demo' ? 'Datos de demostración' : s.provider,
      status: s.status,
      statusReason: s.reason,
      ingestionPaused: s.provider !== 'demo',
      maxItemsPerDay: 5000,
    }));
    const start = new Date(now - 7 * 86400_000).toISOString();
    const cov = (
      provider: CoverageRow['provider'],
      platform: Platform,
      dataKind: CoverageRow['dataKind'],
      status: CoverageRow['status'],
      reason: string,
      n = 0,
    ): CoverageRow => ({
      id: uid(),
      organizationId: org.id,
      dataSourceId: `${org.slug}-src-${provider}`,
      provider,
      platform,
      dataKind,
      status,
      reason,
      accountHandle: provider === 'demo' ? `@${org.slug}` : null,
      periodStart: start,
      periodEnd: null,
      itemsIngested: n,
    });
    const count = (p: Platform) =>
      st.items.filter((i) => i.platform === p).length;
    st.coverage = [
      cov(
        'demo',
        'instagram',
        'comments',
        'complete',
        'Datos ficticios',
        count('instagram'),
      ),
      cov(
        'demo',
        'facebook',
        'comments',
        'complete',
        'Datos ficticios',
        count('facebook'),
      ),
      cov('demo', 'x', 'comments', 'complete', 'Datos ficticios', count('x')),
      cov(
        'metricool',
        'instagram',
        'comments',
        'not_requested',
        'Pendiente de autorización y credenciales',
      ),
      cov(
        'metricool',
        'facebook',
        'comments',
        'not_requested',
        'Pendiente de autorización y credenciales',
      ),
      cov(
        'metricool',
        'tiktok',
        'comments',
        'not_requested',
        'Pendiente; permisos por confirmar con /authorizations',
      ),
      cov(
        'metricool',
        'linkedin',
        'comments',
        'not_requested',
        'Pendiente; permisos por confirmar con /authorizations',
      ),
      cov(
        'meta_graph',
        'instagram',
        'mentions',
        'not_permitted',
        'Menciones de terceros requieren permisos de Meta no concedidos',
      ),
      cov(
        'meta_graph',
        'facebook',
        'comments',
        'not_permitted',
        'Páginas de terceros: requiere Page Public Content Access',
      ),
      cov(
        'youtube_data',
        'youtube',
        'comments',
        'unavailable',
        'Fuente no conectada',
      ),
      cov(
        'x_api',
        'x',
        'mentions',
        'unavailable',
        'Requiere aprobación de gasto (pago por uso)',
      ),
      cov(
        'licensed_feed',
        'web',
        'mentions',
        'unavailable',
        'Prensa y web abierta: fase 2',
      ),
    ];
    st.recipients = [
      {
        id: `${org.slug}-wa-1`,
        displayName: 'Responsable de turno (ficticio)',
        phoneE164: '+570000000001',
        minSeverity: 'high',
        optedInAt: new Date(now - 5 * 86400_000).toISOString(),
        optedOutAt: null,
        isActive: true,
      },
      {
        id: `${org.slug}-wa-2`,
        displayName: 'Gerencia de comunicaciones (ficticio)',
        phoneE164: '+570000000002',
        minSeverity: 'critical',
        optedInAt: new Date(now - 5 * 86400_000).toISOString(),
        optedOutAt: null,
        isActive: true,
      },
      {
        id: `${org.slug}-wa-3`,
        displayName: 'Contacto sin opt-in (ficticio)',
        phoneE164: '+570000000003',
        minSeverity: 'high',
        optedInAt: null,
        optedOutAt: null,
        isActive: true,
      },
    ];
    const crit = st.alerts.find((a) => a.severity === 'critical');
    if (crit) {
      st.dispatches = planDispatch({
        mode: 'simulate',
        alertId: crit.id,
        severity: 'critical',
        reviewConfirmed: crit.reviewStatus === 'confirmed',
        template: 'hf_alerta_critica',
        values: [org.brand, crit.title, String(Math.round(crit.priorityScore))],
        recipients: st.recipients,
      });
    }
    map.set(org.id, st);
  }
  return map;
}

async function store(orgId: string): Promise<OrgStore> {
  storePromise ??= buildStore();
  const s = (await storePromise).get(orgId);
  if (!s) throw new Error('Organización no encontrada');
  return s;
}

function assertMember(viewer: Viewer, orgId: string, roles?: string[]) {
  const u = DEMO_USERS.find((x) => x.id === viewer.userId);
  const m = u?.memberships.find((x) => x.org === orgId);
  if (!m) throw new Error('Sin acceso a esta organización');
  if (roles && !roles.includes(m.role))
    throw new Error('Rol sin permiso para esta acción');
}

export class DemoRepository implements Repository {
  async memberships(viewer: Viewer): Promise<Membership[]> {
    const u = DEMO_USERS.find((x) => x.id === viewer.userId);
    return (u?.memberships ?? []).map((m) => {
      const o = DEMO_ORGS.find((x) => x.id === m.org)!;
      return {
        role: m.role,
        organization: {
          id: o.id,
          name: o.name,
          slug: o.slug,
          isDemo: true,
          retentionDays: 90,
        },
      };
    });
  }
  async items(orgId: string, f: ItemFilters = {}) {
    const s = await store(orgId);
    const q = f.q?.toLowerCase().trim();
    return s.items
      .filter((i) => i.organizationId === orgId)
      .filter(
        (i) =>
          !q ||
          i.body.toLowerCase().includes(q) ||
          i.analysis?.topics.some((t) => t.includes(q)),
      )
      .filter((i) => !f.platform || i.platform === f.platform)
      .filter((i) => !f.sentiment || i.analysis?.sentiment === f.sentiment)
      .filter((i) => !f.severity || i.analysis?.severity === f.severity)
      .filter((i) => !f.layer || i.analysis?.layer === f.layer)
      .filter((i) => !f.reviewPending || i.analysis?.reviewStatus === 'pending')
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, f.limit ?? 200);
  }
  async alerts(orgId: string) {
    return (await store(orgId)).alerts;
  }
  async reviewAlert(
    orgId: string,
    alertId: string,
    decision: 'confirmed' | 'dismissed',
    viewer: Viewer,
  ) {
    assertMember(viewer, orgId, ['owner', 'admin', 'analyst']);
    const a = (await store(orgId)).alerts.find((x) => x.id === alertId);
    if (!a) throw new Error('Alerta no encontrada');
    a.reviewStatus = decision;
  }
  async incidents(orgId: string) {
    return (await store(orgId)).incidents;
  }
  async incident(orgId: string, id: string) {
    return (await store(orgId)).incidents.find((i) => i.id === id) ?? null;
  }
  async openIncidentFromAlert(orgId: string, alertId: string, viewer: Viewer) {
    assertMember(viewer, orgId, ['owner', 'admin', 'analyst', 'responder']);
    const s = await store(orgId);
    const a = s.alerts.find((x) => x.id === alertId);
    if (!a) throw new Error('Alerta no encontrada');
    if (a.incidentId) return a.incidentId;
    if (a.severity === 'critical' && a.reviewStatus !== 'confirmed') {
      throw new Error(
        'Una alerta crítica requiere revisión humana antes de abrir incidente',
      );
    }
    const id = `${orgId.slice(-4)}-inc-${s.incidents.length + 1}`;
    const now = new Date().toISOString();
    s.incidents.unshift({
      id,
      organizationId: orgId,
      alertId,
      title: a.title,
      severity: a.severity,
      status: 'open',
      owner: null,
      openedAt: now,
      closedAt: null,
      resolutionSummary: null,
      isSynthetic: true,
      events: [
        {
          id: uid(),
          kind: 'opened',
          fromStatus: null,
          toStatus: 'open',
          body: a.title,
          actor: viewer.userId,
          createdAt: now,
        },
      ],
    });
    a.incidentId = id;
    return id;
  }
  async transitionIncident(
    orgId: string,
    id: string,
    to: IncidentStatus,
    viewer: Viewer,
    resolution?: string,
  ) {
    assertMember(viewer, orgId, ['owner', 'admin', 'analyst', 'responder']);
    const inc = await this.incident(orgId, id);
    if (!inc) throw new Error('Incidente no encontrado');
    if (!canTransition(inc.status, to))
      throw new Error(`Transición no permitida: ${inc.status} → ${to}`);
    if (requiresResolutionSummary(to) && !resolution?.trim())
      throw new Error('El cierre requiere resumen de resolución');
    const now = new Date().toISOString();
    inc.events.push({
      id: uid(),
      kind:
        to === 'closed' || to === 'false_positive'
          ? 'closed'
          : 'status_changed',
      fromStatus: inc.status,
      toStatus: to,
      body: resolution ?? null,
      actor: viewer.userId,
      createdAt: now,
    });
    inc.status = to;
    if (resolution) inc.resolutionSummary = resolution;
    if (to === 'closed' || to === 'false_positive') inc.closedAt = now;
  }
  async assignIncident(
    orgId: string,
    id: string,
    ownerUserId: string,
    viewer: Viewer,
  ) {
    assertMember(viewer, orgId, ['owner', 'admin', 'analyst', 'responder']);
    const owner = DEMO_USERS.find(
      (u) => u.id === ownerUserId,
    )?.memberships.find((m) => m.org === orgId);
    if (!owner || owner.role === 'viewer')
      throw new Error('El responsable debe ser miembro con rol de gestión');
    const inc = await this.incident(orgId, id);
    if (!inc) throw new Error('Incidente no encontrado');
    inc.owner = ownerUserId;
    inc.events.push({
      id: uid(),
      kind: 'assigned',
      fromStatus: null,
      toStatus: null,
      body: ownerUserId,
      actor: viewer.userId,
      createdAt: new Date().toISOString(),
    });
  }
  async addIncidentNote(
    orgId: string,
    id: string,
    body: string,
    viewer: Viewer,
  ) {
    assertMember(viewer, orgId, ['owner', 'admin', 'analyst', 'responder']);
    const inc = await this.incident(orgId, id);
    if (!inc) throw new Error('Incidente no encontrado');
    inc.events.push({
      id: uid(),
      kind: 'note',
      fromStatus: null,
      toStatus: null,
      body: body.slice(0, 2000),
      actor: viewer.userId,
      createdAt: new Date().toISOString(),
    });
  }
  async sources(orgId: string) {
    return (await store(orgId)).sources;
  }
  async coverage(orgId: string) {
    return (await store(orgId)).coverage;
  }
  async members(orgId: string) {
    return DEMO_USERS.flatMap((u) =>
      u.memberships
        .filter((m) => m.org === orgId)
        .map((m) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          role: m.role,
        })),
    );
  }
  async usage(orgId: string): Promise<UsageSummary> {
    const s = await store(orgId);
    return {
      aiMonthlyUsdLimit: 30,
      aiMonthlyUsdSpent: 0,
      aiDailyItemsLimit: 2000,
      aiDailyItemsUsed: s.aiItems,
      cacheHits: s.cacheHits,
      whatsappMonthlyUsdLimit: 5,
      provider: 'heuristic',
      model: 'heuristic-es-v1',
    };
  }
  async waRecipients(orgId: string) {
    return (await store(orgId)).recipients;
  }
  async waDispatches(orgId: string) {
    return (await store(orgId)).dispatches;
  }
}

/** Solo para pruebas. */
export function __resetDemoStore() {
  storePromise = null;
}
