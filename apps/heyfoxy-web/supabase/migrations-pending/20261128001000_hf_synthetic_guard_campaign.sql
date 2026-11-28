-- Hey Foxy 0010 — Clasificación sintética determinada por la base y topes de campaña de IA
-- (preparación de GO-IA-3: HF-BB-05, HF-QA-08). PREPARADA Y PROBADA SOLO EN LOCAL. No aplicar sin GO.
--
--  * is_synthetic deja de ser un dato que el cliente pueda elegir. Brand Brain (brand_contexts,
--    brand_memory) hereda la clasificación de organizations.is_demo. En social_posts y
--    post_metric_snapshots una organización real NUNCA puede marcar datos como sintéticos para
--    eludir los controles de privacidad del motor de IA; en una organización demo se mantiene
--    el rechazo de contenido no sintético de 0006. organizations.is_demo no es editable por
--    authenticated (0005).
--  * post_media: las imágenes sintéticas propias (host reservado synthetic-media.heyfoxy.invalid,
--    TLD .invalid: nunca se resuelve ni se descarga) solo se admiten en organizaciones de demo.
--  * usage_budgets: tope ACUMULADO de campaña (US$ y llamadas reales desde una fecha), además del
--    mensual. hf_ai_reserve lo aplica bajo el mismo bloqueo por organización.
--  * hf_ai_reserve / hf_ai_note: la marca sintética del consumo solo vale en organizaciones demo.
--  * ai_usage.latency_ms / first_token_ms: latencia registrada por hf_ai_settle (parámetros
--    opcionales: el código anterior sigue funcionando).
--  * Corrige el Brand Brain cuyo is_synthetic no coincide con su organización (Clínica Aurora QA,
--    guardado desde la interfaz con is_synthetic = false: su versión sube en 1, como toda edición
--    de Brand Brain). Se detiene si alguna organización real tuviera publicaciones o mediciones
--    sintéticas.
--  * Idempotente.

-- 1. Clasificación sintética --------------------------------------------------------------------
-- Brand Brain y memoria (edición humana): heredan la clasificación de la organización.
-- Publicaciones y mediciones (datos de fuentes): una organización real NO puede escribir filas
-- sintéticas (se rechaza; no se reclasifica en silencio). En una organización demo siguen
-- vigentes hf_guard_real_data_org (0006, rechaza contenido no sintético) y hf_guard_synthetic
-- (0002, coherencia con el proveedor). Nombres «*_synthetic_class»: no sustituyen a los
-- triggers «*_synthetic» de 0002.
create or replace function public.hf_enforce_synthetic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_demo boolean := coalesce(
    (select o.is_demo from public.organizations o where o.id = new.organization_id), false);
begin
  if tg_table_name in ('brand_contexts', 'brand_memory') then
    new.is_synthetic := v_demo;
  elsif new.is_synthetic and not v_demo then
    raise exception 'synthetic rows only allowed in demo organizations' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.hf_enforce_synthetic() from public, anon, authenticated;

-- Precondición: ninguna organización real tiene filas sintéticas (los guards no son retroactivos).
do $chk$ begin
  if exists (select 1 from public.social_posts p join public.organizations o on o.id = p.organization_id
             where p.is_synthetic and not o.is_demo)
     or exists (select 1 from public.post_metric_snapshots s join public.organizations o on o.id = s.organization_id
                where s.is_synthetic and not o.is_demo) then
    raise exception 'HF 0010: hay filas sintéticas en organizaciones reales; revisar antes de aplicar';
  end if;
end $chk$;

drop trigger if exists brand_contexts_synthetic_class on public.brand_contexts;
create trigger brand_contexts_synthetic_class before insert or update on public.brand_contexts
  for each row execute function public.hf_enforce_synthetic();
drop trigger if exists brand_memory_synthetic_class on public.brand_memory;
create trigger brand_memory_synthetic_class before insert or update on public.brand_memory
  for each row execute function public.hf_enforce_synthetic();
drop trigger if exists social_posts_synthetic_class on public.social_posts;
create trigger social_posts_synthetic_class before insert or update on public.social_posts
  for each row execute function public.hf_enforce_synthetic();
drop trigger if exists post_metric_snapshots_synthetic_class on public.post_metric_snapshots;
create trigger post_metric_snapshots_synthetic_class before insert or update on public.post_metric_snapshots
  for each row execute function public.hf_enforce_synthetic();

-- 2. Imágenes sintéticas propias: solo en organizaciones de demostración ---------------------------
create or replace function public.hf_guard_synthetic_media()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.source_url ~* '^https://synthetic-media\.heyfoxy\.invalid/'
      or coalesce(new.preview_url, '') ~* '^https://synthetic-media\.heyfoxy\.invalid/')
     and not coalesce((select o.is_demo from public.organizations o where o.id = new.organization_id), false) then
    raise exception 'synthetic media only allowed in demo organizations' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.hf_guard_synthetic_media() from public, anon, authenticated;
drop trigger if exists post_media_synthetic_guard on public.post_media;
create trigger post_media_synthetic_guard before insert or update on public.post_media
  for each row execute function public.hf_guard_synthetic_media();

-- 3. Corrección de Brand Brain existente (el trigger fija el valor correcto) ----------------------
update public.brand_contexts b set is_synthetic = o.is_demo
  from public.organizations o where o.id = b.organization_id and b.is_synthetic <> o.is_demo;
update public.brand_memory b set is_synthetic = o.is_demo
  from public.organizations o where o.id = b.organization_id and b.is_synthetic <> o.is_demo;

-- 4. Topes acumulados de campaña ------------------------------------------------------------------
alter table public.usage_budgets add column if not exists ai_campaign_usd numeric(10,2)
  check (ai_campaign_usd is null or ai_campaign_usd >= 0);
alter table public.usage_budgets add column if not exists ai_campaign_calls integer
  check (ai_campaign_calls is null or ai_campaign_calls >= 0);
alter table public.usage_budgets add column if not exists ai_campaign_since timestamptz;

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
  v_camp_usd numeric;
  v_camp_calls integer;
  v_camp_since timestamptz;
  v_synthetic boolean;
  v_id uuid;
begin
  if p_est is null or p_est < 0 or p_est > 5 then
    raise exception 'invalid estimate' using errcode = '22023';
  end if;
  -- La marca sintética solo vale en organizaciones de demostración.
  v_synthetic := coalesce(p_synthetic, false)
    and coalesce((select o.is_demo from public.organizations o where o.id = p_org), false);
  perform pg_advisory_xact_lock(hashtextextended('hf_ai:' || p_org::text, 0));
  if v_synthetic then
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

  select least(coalesce(b.ai_monthly_usd, p_cap_usd), p_cap_usd), coalesce(b.ai_daily_items, 2000),
         b.ai_campaign_usd, b.ai_campaign_calls, coalesce(b.ai_campaign_since, '-infinity'::timestamptz)
    into v_limit, v_items, v_camp_usd, v_camp_calls, v_camp_since
    from (select 1) one left join public.usage_budgets b on b.organization_id = p_org;
  select coalesce(sum(cost_usd), 0) into v_spent
    from public.ai_usage where organization_id = p_org and created_at >= v_month;
  select coalesce(sum(est_usd), 0) into v_reserved
    from public.ai_reservations where organization_id = p_org;
  if v_spent + v_reserved + p_est > v_limit then
    return query select false, 'budget', null::uuid; return;
  end if;

  -- Campaña: acumulado desde ai_campaign_since (no se reinicia con el mes).
  if v_camp_usd is not null then
    select coalesce(sum(cost_usd), 0) into v_spent
      from public.ai_usage where organization_id = p_org and created_at >= v_camp_since;
    if v_spent + v_reserved + p_est > v_camp_usd then
      return query select false, 'campaign_budget', null::uuid; return;
    end if;
  end if;
  if v_camp_calls is not null and (
       (select count(*) from public.ai_usage
         where organization_id = p_org and created_at >= v_camp_since
           and provider <> 'local' and status <> 'fallback' and not cache_hit)
     + (select count(*) from public.ai_reservations where organization_id = p_org)
     ) >= v_camp_calls then
    return query select false, 'campaign_calls', null::uuid; return;
  end if;

  if v_synthetic then
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
    values (p_org, p_user, p_request, p_task, p_model, p_est, v_synthetic)
    returning id into v_id;
  return query select true, 'ok', v_id;
end;
$$;

create or replace function public.hf_ai_note(
  p_org uuid, p_user uuid, p_task text, p_provider text, p_model text, p_status text,
  p_cache_hit boolean, p_synthetic boolean, p_brand_version integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_usage (organization_id, task, provider, model, cost_usd, cache_hit, user_id,
      status, input_is_synthetic, brand_version)
    values (p_org, p_task, p_provider, p_model, 0, p_cache_hit, p_user, p_status,
      coalesce(p_synthetic, false)
        and coalesce((select o.is_demo from public.organizations o where o.id = p_org), false),
      p_brand_version);
$$;

revoke all on function public.hf_ai_reserve(uuid, uuid, text, text, text, numeric, boolean, numeric, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.hf_ai_note(uuid, uuid, text, text, text, text, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.hf_ai_reserve(uuid, uuid, text, text, text, numeric, boolean, numeric, numeric, integer, integer) to service_role;
grant execute on function public.hf_ai_note(uuid, uuid, text, text, text, text, boolean, boolean, integer) to service_role;

-- 5. Latencias por llamada (tiempo total y hasta el primer fragmento del streaming) -------------
alter table public.ai_usage add column if not exists latency_ms integer
  check (latency_ms is null or latency_ms >= 0);
alter table public.ai_usage add column if not exists first_token_ms integer
  check (first_token_ms is null or first_token_ms >= 0);
-- La firma cambia (dos parámetros opcionales al final): el código anterior, que llama con los diez
-- parámetros con nombre, sigue funcionando.
drop function if exists public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text);
create or replace function public.hf_ai_settle(
  p_reservation uuid, p_provider text, p_status text, p_input integer, p_output integer,
  p_cache_read integer, p_cache_write integer, p_cost numeric, p_brand_version integer,
  p_prompt_version text, p_latency_ms integer default null, p_first_token_ms integer default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare r public.ai_reservations%rowtype;
begin
  delete from public.ai_reservations where id = p_reservation returning * into r;
  if not found then return; end if;  -- idempotente: ya liquidada o caducada
  insert into public.ai_usage (organization_id, task, provider, model, input_tokens, output_tokens,
      cost_usd, cache_hit, user_id, status, cache_read_tokens, cache_write_tokens, brand_version,
      prompt_version, input_is_synthetic, request_id, latency_ms, first_token_ms)
    values (r.organization_id, r.task, p_provider, r.model, greatest(p_input, 0), greatest(p_output, 0),
      greatest(p_cost, 0), false, r.user_id, p_status, greatest(p_cache_read, 0), greatest(p_cache_write, 0),
      p_brand_version, p_prompt_version, r.input_is_synthetic, r.request_id,
      case when p_latency_ms >= 0 then p_latency_ms end, case when p_first_token_ms >= 0 then p_first_token_ms end);
end;
$$;
revoke all on function public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hf_ai_settle(uuid, text, text, integer, integer, integer, integer, numeric, integer, text, integer, integer) to service_role;
