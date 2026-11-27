-- Hey Foxy 0009 — Foxy Intelligence Engine generativo: consumo, reservas de presupuesto y
-- caché (WO-HF-AI-ENGINE-001 §9). PREPARADA Y PROBADA SOLO EN LOCAL. No aplicar sin GO.
--
--  * ai_usage: usuario, estado (ok/error/cancelled/refusal/incomplete/fallback), tokens de
--    caché, versión de Brand Brain e instrucciones, entrada sintética e id de solicitud
--    (único por organización: una solicitud duplicada no se cobra dos veces).
--  * ai_reservations: reserva del costo máximo ANTES de llamar al proveedor; caduca a los
--    5 minutos (una instancia caída no bloquea el presupuesto).
--  * hf_ai_reserve / hf_ai_settle / hf_ai_release / hf_ai_note: SECURITY DEFINER, solo
--    service_role. La reserva toma un bloqueo transaccional por organización (y uno global
--    para las pruebas sintéticas): varias instancias no pueden sobrepasar el presupuesto.
--  * Sin cambios en las políticas existentes. ai_reservations no es legible por usuarios.
--  * Idempotente.

alter table public.ai_usage add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.ai_usage add column if not exists status text not null default 'ok';
alter table public.ai_usage add column if not exists cache_read_tokens integer not null default 0;
alter table public.ai_usage add column if not exists cache_write_tokens integer not null default 0;
alter table public.ai_usage add column if not exists brand_version integer;
alter table public.ai_usage add column if not exists prompt_version text;
alter table public.ai_usage add column if not exists input_is_synthetic boolean not null default false;
alter table public.ai_usage add column if not exists request_id text;
alter table public.ai_usage drop constraint if exists ai_usage_status_check;
alter table public.ai_usage add constraint ai_usage_status_check
  check (status in ('ok', 'error', 'cancelled', 'refusal', 'incomplete', 'fallback'));
alter table public.ai_usage drop constraint if exists ai_usage_tokens_check;
alter table public.ai_usage add constraint ai_usage_tokens_check
  check (input_tokens >= 0 and output_tokens >= 0 and cache_read_tokens >= 0
         and cache_write_tokens >= 0 and cost_usd >= 0);
create unique index if not exists ai_usage_request_uidx
  on public.ai_usage (organization_id, request_id) where request_id is not null;

create table if not exists public.ai_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null check (length(request_id) between 8 and 80),
  task text not null check (task in ('post_tagging', 'content_analysis', 'ask', 'strategy_report')),
  model text not null check (length(model) between 1 and 80),
  est_usd numeric(10,6) not null check (est_usd >= 0 and est_usd <= 5),
  input_is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  unique (organization_id, request_id)
);
alter table public.ai_reservations enable row level security;
revoke all on table public.ai_reservations from public, anon, authenticated, service_role;
grant select, insert, delete on table public.ai_reservations to service_role;

create or replace function public.hf_ai_reserve(
  p_org uuid, p_user uuid, p_request text, p_task text, p_model text, p_est numeric,
  p_synthetic boolean, p_cap_usd numeric, p_synth_cap numeric, p_user_daily integer,
  p_concurrency integer)
returns table (ok boolean, code text, reservation_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_day timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_limit numeric;
  v_items integer;
  v_spent numeric;
  v_reserved numeric;
  v_id uuid;
begin
  if p_est is null or p_est < 0 or p_est > 5 then
    raise exception 'invalid estimate' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('hf_ai:' || p_org::text, 0));
  if p_synthetic then
    perform pg_advisory_xact_lock(hashtextextended('hf_ai:synthetic', 0));
  end if;
  delete from public.ai_reservations where expires_at < now();

  if exists (select 1 from public.hf_runtime_flags where flag = 'ai_kill_switch' and enabled) then
    return query select false, 'kill_switch', null::uuid; return;
  end if;
  if exists (select 1 from public.ai_reservations where organization_id = p_org and request_id = p_request)
     or exists (select 1 from public.ai_usage where organization_id = p_org and request_id = p_request) then
    return query select false, 'duplicate', null::uuid; return;
  end if;
  if (select count(*) from public.ai_reservations where organization_id = p_org) >= greatest(p_concurrency, 1) then
    return query select false, 'concurrency', null::uuid; return;
  end if;

  select least(coalesce(b.ai_monthly_usd, p_cap_usd), p_cap_usd), coalesce(b.ai_daily_items, 2000)
    into v_limit, v_items
    from (select 1) one left join public.usage_budgets b on b.organization_id = p_org;
  select coalesce(sum(cost_usd), 0) into v_spent
    from public.ai_usage where organization_id = p_org and created_at >= v_month;
  select coalesce(sum(est_usd), 0) into v_reserved
    from public.ai_reservations where organization_id = p_org;
  if v_spent + v_reserved + p_est > v_limit then
    return query select false, 'budget', null::uuid; return;
  end if;

  if p_synthetic then
    select coalesce(sum(cost_usd), 0) into v_spent from public.ai_usage where input_is_synthetic;
    select coalesce(sum(est_usd), 0) into v_reserved from public.ai_reservations where input_is_synthetic;
    if v_spent + v_reserved + p_est > p_synth_cap then
      return query select false, 'synthetic_cap', null::uuid; return;
    end if;
  end if;

  if p_user is not null and (
       (select count(*) from public.ai_usage
         where organization_id = p_org and user_id = p_user and created_at >= v_day
           and status <> 'fallback' and not cache_hit)
     + (select count(*) from public.ai_reservations where organization_id = p_org and user_id = p_user)
     ) >= p_user_daily then
    return query select false, 'user_limit', null::uuid; return;
  end if;
  if (select count(*) from public.ai_usage
       where organization_id = p_org and created_at >= v_day and status <> 'fallback' and not cache_hit)
     + (select count(*) from public.ai_reservations where organization_id = p_org) >= v_items then
    return query select false, 'daily_items', null::uuid; return;
  end if;

  insert into public.ai_reservations (organization_id, user_id, request_id, task, model, est_usd, input_is_synthetic)
    values (p_org, p_user, p_request, p_task, p_model, p_est, p_synthetic)
    returning id into v_id;
  return query select true, 'ok', v_id;
end;
$$;

create or replace function public.hf_ai_settle(
  p_reservation uuid, p_provider text, p_status text, p_input integer, p_output integer,
  p_cache_read integer, p_cache_write integer, p_cost numeric, p_brand_version integer,
  p_prompt_version text)
returns void
language plpgsql security definer set search_path = '' as $$
declare r public.ai_reservations%rowtype;
begin
  delete from public.ai_reservations where id = p_reservation returning * into r;
  if not found then return; end if;  -- idempotente: ya liquidada o caducada
  insert into public.ai_usage (organization_id, task, provider, model, input_tokens, output_tokens,
      cost_usd, cache_hit, user_id, status, cache_read_tokens, cache_write_tokens, brand_version,
      prompt_version, input_is_synthetic, request_id)
    values (r.organization_id, r.task, p_provider, r.model, greatest(p_input, 0), greatest(p_output, 0),
      greatest(p_cost, 0), false, r.user_id, p_status, greatest(p_cache_read, 0), greatest(p_cache_write, 0),
      p_brand_version, p_prompt_version, r.input_is_synthetic, r.request_id);
end;
$$;

create or replace function public.hf_ai_release(p_reservation uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.ai_reservations where id = p_reservation;
$$;

create or replace function public.hf_ai_note(
  p_org uuid, p_user uuid, p_task text, p_provider text, p_model text, p_status text,
  p_cache_hit boolean, p_synthetic boolean, p_brand_version integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_usage (organization_id, task, provider, model, cost_usd, cache_hit, user_id,
      status, input_is_synthetic, brand_version)
    values (p_org, p_task, p_provider, p_model, 0, p_cache_hit, p_user, p_status, p_synthetic, p_brand_version);
$$;

revoke all on function public.hf_ai_reserve(uuid, uuid, text, text, text, numeric, boolean, numeric, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text) from public, anon, authenticated;
revoke all on function public.hf_ai_release(uuid) from public, anon, authenticated;
revoke all on function public.hf_ai_note(uuid, uuid, text, text, text, text, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.hf_ai_reserve(uuid, uuid, text, text, text, numeric, boolean, numeric, numeric, integer, integer) to service_role;
grant execute on function public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text) to service_role;
grant execute on function public.hf_ai_release(uuid) to service_role;
grant execute on function public.hf_ai_note(uuid, uuid, text, text, text, text, boolean, boolean, integer) to service_role;
