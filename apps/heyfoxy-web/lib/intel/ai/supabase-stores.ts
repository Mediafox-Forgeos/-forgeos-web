import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serviceKeyKind, serviceKeyUsable } from '@/lib/sync/guards';
import {
  RESERVE_FAILURE_LABEL,
  summarize,
  type AiTask,
  type AiUsageSummary,
  type BudgetStore,
  type ReserveFailure,
  type ReserveInput,
  type ReserveResult,
  type SettleInput,
  type UsageRecord,
  type UsageStatus,
} from './budget';
import type { GenCacheEntry, GenCacheStore, GenMeta } from './engine';

/**
 * Persistencia del motor generativo en Supabase (migración 0009, servidor). El cliente
 * service role vive solo aquí (`server-only`). Toda operación lleva el id de la organización
 * activa, que el servidor obtuvo de la sesión y de una membresía real (requireContext): el
 * navegador nunca elige la organización ni ve estas tablas directamente.
 * Errores de la base → mensajes sin valores de filas.
 */
export function aiPersistenceReady(): boolean {
  return (
    process.env.HF_MIGRATION_0009_APPLIED === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    serviceKeyUsable(serviceKeyKind(process.env.HF_SUPABASE_SERVICE_ROLE_KEY))
  );
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.HF_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}

const fail = (e: { code?: string } | null, what: string) => {
  if (e)
    throw new Error(
      `Foxy IA: error de la base en ${what} (${e.code ?? 'sin código'})`,
    );
};

export class SupabaseBudgetStore implements BudgetStore {
  async killSwitch() {
    const { data, error } = await db()
      .from('hf_runtime_flags')
      .select('enabled')
      .eq('flag', 'ai_kill_switch')
      .maybeSingle();
    // Ante un error de lectura, se asume apagado por seguridad: no se llama al proveedor.
    if (error) return true;
    return data?.enabled === true;
  }

  async reserve(i: ReserveInput): Promise<ReserveResult> {
    const { data, error } = await db().rpc('hf_ai_reserve', {
      p_org: i.orgId,
      p_user: /^[0-9a-f-]{36}$/i.test(i.userId) ? i.userId : null,
      p_request: i.requestId,
      p_task: i.task,
      p_model: i.model,
      p_est: Math.min(5, Math.round(i.estUsd * 1e6) / 1e6),
      p_synthetic: i.synthetic,
      p_cap_usd: i.limits.orgMonthlyUsd,
      p_synth_cap: i.limits.syntheticCapUsd,
      p_user_daily: i.limits.userDailyRequests,
      p_concurrency: i.limits.orgConcurrency,
    });
    fail(error, 'la reserva de presupuesto');
    const row = (
      data as Array<{
        ok: boolean;
        code: string;
        reservation_id: string | null;
      }>
    )[0];
    if (!row?.ok || !row.reservation_id) {
      const code = (row?.code ?? 'budget') as ReserveFailure;
      return {
        ok: false,
        code,
        message: RESERVE_FAILURE_LABEL[code] ?? RESERVE_FAILURE_LABEL.budget,
      };
    }
    return {
      ok: true,
      reservation: {
        id: row.reservation_id,
        orgId: i.orgId,
        userId: i.userId,
        task: i.task,
        model: i.model,
        estUsd: i.estUsd,
        requestId: i.requestId,
        synthetic: i.synthetic,
      },
    };
  }

  async settle(s: SettleInput) {
    const { error } = await db().rpc('hf_ai_settle', {
      p_reservation: s.reservation.id,
      p_provider: s.provider,
      p_status: s.status,
      p_input: s.usage.inputTokens,
      p_output: s.usage.outputTokens,
      p_cache_read: s.usage.cacheReadTokens,
      p_cache_write: s.usage.cacheWriteTokens,
      p_cost: s.costUsd,
      p_brand_version: s.brandVersion,
      p_prompt_version: s.promptVersion,
    });
    fail(error, 'el registro de consumo');
  }

  async release(r: { id: string }) {
    const { error } = await db().rpc('hf_ai_release', { p_reservation: r.id });
    fail(error, 'la liberación de la reserva');
  }

  async note(rec: Omit<UsageRecord, 'createdAt' | 'usage' | 'costUsd'>) {
    const { error } = await db().rpc('hf_ai_note', {
      p_org: rec.orgId,
      p_user:
        rec.userId && /^[0-9a-f-]{36}$/i.test(rec.userId) ? rec.userId : null,
      p_task: rec.task,
      p_provider: rec.provider,
      p_model: rec.model,
      p_status: rec.status,
      p_cache_hit: rec.cacheHit,
      p_synthetic: rec.synthetic,
      p_brand_version: rec.brandVersion,
    });
    fail(error, 'el registro de consumo');
  }

  async summary(orgId: string, limitUsd: number): Promise<AiUsageSummary> {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();
    const [u, r] = await Promise.all([
      db()
        .from('ai_usage')
        .select(
          'task, provider, model, status, cache_hit, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, input_is_synthetic, brand_version, created_at, user_id',
        )
        .eq('organization_id', orgId)
        .gte('created_at', from),
      db()
        .from('ai_reservations')
        .select('est_usd')
        .eq('organization_id', orgId),
    ]);
    fail(u.error, 'la lectura de consumo');
    fail(r.error, 'la lectura de reservas');
    const rows: UsageRecord[] = (u.data ?? []).map(
      (x: Record<string, unknown>) => ({
        orgId,
        userId: (x.user_id as string) ?? null,
        task: x.task as AiTask,
        provider: String(x.provider),
        model: String(x.model),
        status: (x.status as UsageStatus) ?? 'ok',
        usage: {
          inputTokens: Number(x.input_tokens ?? 0),
          outputTokens: Number(x.output_tokens ?? 0),
          cacheReadTokens: Number(x.cache_read_tokens ?? 0),
          cacheWriteTokens: Number(x.cache_write_tokens ?? 0),
        },
        costUsd: Number(x.cost_usd ?? 0),
        cacheHit: x.cache_hit === true,
        synthetic: x.input_is_synthetic === true,
        brandVersion: (x.brand_version as number) ?? null,
        createdAt: String(x.created_at),
      }),
    );
    const reserved = (r.data ?? []).reduce(
      (s: number, x: Record<string, unknown>) => s + Number(x.est_usd ?? 0),
      0,
    );
    return summarize(rows, reserved, limitUsd);
  }
}

/** Caché del análisis generativo en content_intel_cache (0007): salida = {intel, meta}. */
export class SupabaseGenCache implements GenCacheStore {
  async get<T>(orgId: string, subject: string, hash: string) {
    const { data, error } = await db()
      .from('content_intel_cache')
      .select('input_hash, output')
      .eq('organization_id', orgId)
      .eq('subject_type', 'post')
      .eq('subject_key', subject)
      .eq('input_hash', hash)
      .maybeSingle();
    if (error || !data) return null;
    const out = data.output as { value: T; meta: GenMeta };
    return {
      inputHash: data.input_hash as string,
      value: out.value,
      meta: out.meta,
    };
  }

  async latest<T>(orgId: string, subject: string) {
    const { data, error } = await db()
      .from('content_intel_cache')
      .select('input_hash, output')
      .eq('organization_id', orgId)
      .eq('subject_type', 'post')
      .eq('subject_key', subject)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const out = data.output as { value: T; meta: GenMeta };
    return {
      inputHash: data.input_hash as string,
      value: out.value,
      meta: out.meta,
    };
  }

  async put<T>(
    orgId: string,
    subject: string,
    e: GenCacheEntry<T>,
    synthetic: boolean,
  ) {
    const { error } = await db()
      .from('content_intel_cache')
      .upsert(
        {
          organization_id: orgId,
          subject_type: 'post',
          subject_key: subject,
          input_hash: e.inputHash,
          provider: e.meta.provider,
          model: e.meta.model,
          prompt_version: e.meta.promptVersion,
          output: { value: e.value, meta: e.meta },
          input_is_synthetic: synthetic,
        },
        {
          onConflict: 'organization_id,subject_type,input_hash',
          ignoreDuplicates: true,
        },
      );
    fail(error, 'la caché de análisis');
  }
}
