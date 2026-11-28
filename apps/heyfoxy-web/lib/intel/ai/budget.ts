import type { TokenUsage } from './catalog';

/**
 * Control de costos del Foxy Intelligence Engine (WO-HF-AI-ENGINE-001 §9).
 *
 * Antes de cada llamada generativa se RESERVA el costo máximo previsible (entrada estimada +
 * `max_tokens` completo como salida). La reserva falla — y Foxy vuelve al motor local con el
 * motivo — si:
 *   · el interruptor de emergencia está activo,
 *   · gastado + reservado + esta solicitud supera el presupuesto mensual de la organización
 *     (el menor entre usage_budgets y HF_AI_ORG_MONTHLY_CAP_USD),
 *   · es una prueba sintética y se supera el tope total de pruebas (US$5 por defecto),
 *   · el usuario agotó sus solicitudes del día, o la organización sus ítems diarios,
 *   · la organización ya tiene el máximo de llamadas simultáneas,
 *   · la misma solicitud (mismo id) ya está en curso o se procesó (duplicado).
 * Al terminar se LIQUIDA con el costo real calculado por código a partir del `usage` del
 * proveedor (nunca lo calcula el modelo) y se libera la reserva.
 *
 * Implementaciones: memoria del proceso (demo y pruebas) y Supabase (migración 0009, con
 * reserva atómica bajo bloqueo por organización: varias instancias no pueden sobrepasar el
 * presupuesto a la vez).
 */
export type AiTask =
  'post_tagging' | 'content_analysis' | 'ask' | 'strategy_report';

export const AI_TASK_LABEL: Record<AiTask, string> = {
  post_tagging: 'Etiquetado de publicaciones',
  content_analysis: 'Análisis de contenido',
  ask: 'Ask Foxy',
  strategy_report: 'Diagnóstico estratégico',
};

export type UsageStatus =
  'ok' | 'error' | 'cancelled' | 'refusal' | 'incomplete' | 'fallback';

/**
 * Tope ACUMULADO de una campaña de pruebas (0010): costo y llamadas reales al proveedor desde
 * `since`. No se reinicia con el mes. Respaldos locales y reutilizaciones por caché no cuentan.
 */
export interface CampaignLimits {
  usd: number | null;
  calls: number | null;
  since: string | null;
}

export interface BudgetLimits {
  /** Límite mensual efectivo de la organización en US$. */
  orgMonthlyUsd: number;
  campaign?: CampaignLimits | null;
  orgDailyItems: number;
  syntheticCapUsd: number;
  userDailyRequests: number;
  orgConcurrency: number;
}

export interface ReserveInput {
  orgId: string;
  userId: string;
  task: AiTask;
  model: string;
  estUsd: number;
  requestId: string;
  synthetic: boolean;
  limits: BudgetLimits;
}

export type ReserveFailure =
  | 'kill_switch'
  | 'budget'
  | 'synthetic_cap'
  | 'user_limit'
  | 'daily_items'
  | 'concurrency'
  | 'duplicate'
  | 'campaign_budget'
  | 'campaign_calls';

export const RESERVE_FAILURE_LABEL: Record<ReserveFailure, string> = {
  kill_switch: 'Interruptor de emergencia de IA activo.',
  budget:
    'Presupuesto mensual de IA de la organización agotado: Foxy usa el motor local por reglas.',
  synthetic_cap:
    'Tope de pruebas sintéticas alcanzado: Foxy usa el motor local por reglas.',
  user_limit:
    'Alcanzaste el límite diario de consultas generativas: Foxy usa el motor local por reglas.',
  daily_items:
    'La organización alcanzó su límite diario de análisis: Foxy usa el motor local por reglas.',
  concurrency:
    'Hay otras generaciones en curso en esta organización; inténtalo en unos segundos.',
  duplicate: 'Esta solicitud ya se está procesando.',
  campaign_budget:
    'Presupuesto acumulado de la campaña de pruebas agotado: Foxy usa el motor local por reglas.',
  campaign_calls:
    'Se alcanzó el máximo de llamadas reales de la campaña de pruebas: Foxy usa el motor local por reglas.',
};

export interface Reservation {
  id: string;
  orgId: string;
  userId: string;
  task: AiTask;
  model: string;
  estUsd: number;
  requestId: string;
  synthetic: boolean;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; code: ReserveFailure; message: string };

export interface SettleInput {
  reservation: Reservation;
  provider: string;
  usage: TokenUsage;
  costUsd: number;
  status: UsageStatus;
  brandVersion: number | null;
  promptVersion: string;
  /** Tiempo total de la llamada y hasta el primer fragmento (streaming), en ms. */
  latencyMs?: number | null;
  firstTokenMs?: number | null;
}

export interface UsageRecord {
  orgId: string;
  userId: string | null;
  task: AiTask;
  provider: string;
  model: string;
  status: UsageStatus;
  usage: TokenUsage;
  costUsd: number;
  cacheHit: boolean;
  synthetic: boolean;
  brandVersion: number | null;
  createdAt: string;
  latencyMs?: number | null;
  firstTokenMs?: number | null;
}

export interface AiUsageSummary {
  monthSpentUsd: number;
  reservedUsd: number;
  limitUsd: number;
  requests: number;
  cacheHits: number;
  fallbacks: number;
  errors: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  byTask: Array<{ task: AiTask; requests: number; costUsd: number }>;
  byModel: Array<{
    model: string;
    provider: string;
    requests: number;
    costUsd: number;
  }>;
}

export interface BudgetStore {
  killSwitch(): Promise<boolean>;
  reserve(input: ReserveInput): Promise<ReserveResult>;
  settle(input: SettleInput): Promise<void>;
  release(reservation: Reservation): Promise<void>;
  /** Registra una reutilización por caché o un uso del motor local de respaldo (costo 0). */
  note(
    rec: Omit<UsageRecord, 'createdAt' | 'usage' | 'costUsd'>,
  ): Promise<void>;
  summary(orgId: string, limitUsd: number): Promise<AiUsageSummary>;
  /** Consumo acumulado de la campaña de pruebas: costo y llamadas reales al proveedor. */
  campaignUsage(
    orgId: string,
    since: string | null,
  ): Promise<{ spentUsd: number; realCalls: number }>;
}

/** Llamada real al proveedor (excluye respaldos locales y reutilizaciones por caché). */
export const isRealCall = (
  r: Pick<UsageRecord, 'provider' | 'status' | 'cacheHit'>,
) => r.provider !== 'local' && r.status !== 'fallback' && !r.cacheHit;

const monthStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
const dayStart = (now: Date) => now.toISOString().slice(0, 10);

export function summarize(
  rows: UsageRecord[],
  reservedUsd: number,
  limitUsd: number,
): AiUsageSummary {
  const billable = rows.filter((r) => r.status !== 'fallback' && !r.cacheHit);
  const byTask = new Map<AiTask, { requests: number; costUsd: number }>();
  const byModel = new Map<
    string,
    { model: string; provider: string; requests: number; costUsd: number }
  >();
  for (const r of billable) {
    const t = byTask.get(r.task) ?? { requests: 0, costUsd: 0 };
    t.requests++;
    t.costUsd += r.costUsd;
    byTask.set(r.task, t);
    const k = `${r.provider}|${r.model}`;
    const m = byModel.get(k) ?? {
      model: r.model,
      provider: r.provider,
      requests: 0,
      costUsd: 0,
    };
    m.requests++;
    m.costUsd += r.costUsd;
    byModel.set(k, m);
  }
  const sum = (f: (r: UsageRecord) => number) =>
    billable.reduce((s, r) => s + f(r), 0);
  return {
    monthSpentUsd: Math.round(sum((r) => r.costUsd) * 1e6) / 1e6,
    reservedUsd,
    limitUsd,
    requests: billable.length,
    cacheHits: rows.filter((r) => r.cacheHit).length,
    fallbacks: rows.filter((r) => r.status === 'fallback').length,
    errors: billable.filter((r) => r.status !== 'ok').length,
    tokens: {
      input: sum((r) => r.usage.inputTokens),
      output: sum((r) => r.usage.outputTokens),
      cacheRead: sum((r) => r.usage.cacheReadTokens),
      cacheWrite: sum((r) => r.usage.cacheWriteTokens),
    },
    byTask: [...byTask].map(([task, v]) => ({ task, ...v })),
    byModel: [...byModel.values()],
  };
}

/** Almacén en memoria del proceso: modo demo y pruebas (nunca datos reales). */
export class MemoryBudgetStore implements BudgetStore {
  rows: UsageRecord[] = [];
  active = new Map<string, Reservation>();
  seen = new Set<string>();
  dailyRequests = new Map<string, number>();
  dbKillSwitch = false;
  private seq = 0;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async killSwitch() {
    return this.dbKillSwitch;
  }

  private spent(filter: (r: UsageRecord) => boolean) {
    const from = monthStart(this.now());
    return this.rows
      .filter((r) => r.createdAt >= from && filter(r))
      .reduce((s, r) => s + r.costUsd, 0);
  }

  async reserve(i: ReserveInput): Promise<ReserveResult> {
    const fail = (code: ReserveFailure): ReserveResult => ({
      ok: false,
      code,
      message: RESERVE_FAILURE_LABEL[code],
    });
    if (this.dbKillSwitch) return fail('kill_switch');
    const key = `${i.orgId}|${i.requestId}`;
    if (this.seen.has(key)) return fail('duplicate');
    const orgActive = [...this.active.values()].filter(
      (r) => r.orgId === i.orgId,
    );
    if (orgActive.length >= i.limits.orgConcurrency) return fail('concurrency');
    const reserved = orgActive.reduce((s, r) => s + r.estUsd, 0);
    if (
      this.spent((r) => r.orgId === i.orgId) + reserved + i.estUsd >
      i.limits.orgMonthlyUsd
    )
      return fail('budget');
    const camp = i.limits.campaign;
    if (camp && (camp.usd != null || camp.calls != null)) {
      const since = camp.since ?? '';
      const inCampaign = this.rows.filter(
        (r) => r.orgId === i.orgId && r.createdAt >= since,
      );
      if (
        camp.usd != null &&
        inCampaign.reduce((s, r) => s + r.costUsd, 0) + reserved + i.estUsd >
          camp.usd
      )
        return fail('campaign_budget');
      const calls = inCampaign.filter(isRealCall).length;
      if (camp.calls != null && calls + orgActive.length >= camp.calls)
        return fail('campaign_calls');
    }
    if (i.synthetic) {
      const synthReserved = [...this.active.values()]
        .filter((r) => r.synthetic)
        .reduce((s, r) => s + r.estUsd, 0);
      if (
        this.spent((r) => r.synthetic) + synthReserved + i.estUsd >
        i.limits.syntheticCapUsd
      )
        return fail('synthetic_cap');
    }
    const today = dayStart(this.now());
    const uKey = `${today}|${i.orgId}|${i.userId}`;
    if ((this.dailyRequests.get(uKey) ?? 0) >= i.limits.userDailyRequests)
      return fail('user_limit');
    const orgToday = this.rows.filter(
      (r) =>
        r.orgId === i.orgId &&
        r.createdAt.startsWith(today) &&
        r.status !== 'fallback' &&
        !r.cacheHit,
    ).length;
    if (orgToday + orgActive.length >= i.limits.orgDailyItems)
      return fail('daily_items');
    this.seen.add(key);
    this.dailyRequests.set(uKey, (this.dailyRequests.get(uKey) ?? 0) + 1);
    const reservation: Reservation = {
      id: `res-${++this.seq}`,
      orgId: i.orgId,
      userId: i.userId,
      task: i.task,
      model: i.model,
      estUsd: i.estUsd,
      requestId: i.requestId,
      synthetic: i.synthetic,
    };
    this.active.set(reservation.id, reservation);
    return { ok: true, reservation };
  }

  async settle(s: SettleInput) {
    if (!this.active.delete(s.reservation.id)) return;
    this.rows.push({
      orgId: s.reservation.orgId,
      userId: s.reservation.userId,
      task: s.reservation.task,
      provider: s.provider,
      model: s.reservation.model,
      status: s.status,
      usage: s.usage,
      costUsd: s.costUsd,
      cacheHit: false,
      synthetic: s.reservation.synthetic,
      brandVersion: s.brandVersion,
      createdAt: this.now().toISOString(),
      latencyMs: s.latencyMs ?? null,
      firstTokenMs: s.firstTokenMs ?? null,
    });
  }

  async release(r: Reservation) {
    this.active.delete(r.id);
  }

  async note(rec: Omit<UsageRecord, 'createdAt' | 'usage' | 'costUsd'>) {
    this.rows.push({
      ...rec,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      costUsd: 0,
      createdAt: this.now().toISOString(),
    });
  }

  async campaignUsage(orgId: string, since: string | null) {
    const rows = this.rows.filter(
      (r) => r.orgId === orgId && r.createdAt >= (since ?? ''),
    );
    return {
      spentUsd: Math.round(rows.reduce((s, r) => s + r.costUsd, 0) * 1e6) / 1e6,
      realCalls: rows.filter(isRealCall).length,
    };
  }

  async summary(orgId: string, limitUsd: number) {
    const from = monthStart(this.now());
    const reserved = [...this.active.values()]
      .filter((r) => r.orgId === orgId)
      .reduce((s, r) => s + r.estUsd, 0);
    return summarize(
      this.rows.filter((r) => r.orgId === orgId && r.createdAt >= from),
      reserved,
      limitUsd,
    );
  }
}
