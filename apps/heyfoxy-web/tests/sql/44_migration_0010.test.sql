-- Hey Foxy — pruebas de la migración 0010 (clasificación sintética y topes de campaña de IA).
\set QUIET on
create or replace function public.t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function public.t_expect_error(stmt text, msg text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (rechazado: %)', msg, sqlerrm; return; end;
raise exception 'ASSERT FAILED (se esperaba error): %', msg; end $$;
grant execute on function public.t_assert(boolean, text), public.t_expect_error(text, text) to authenticated, anon, service_role;

-- Organización REAL (r) y de DEMOSTRACIÓN (d).
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'owner-real@demo.test'),
  ('a1000000-0000-0000-0000-000000000002', 'owner-demo@demo.test');
insert into public.organizations (id, name, slug, is_demo) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'Org real', 'org-real-10', false),
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'Org demo', 'org-demo-10', true);
insert into public.memberships (organization_id, user_id, role) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'a1000000-0000-0000-0000-000000000002', 'owner');
insert into public.data_sources (id, organization_id, provider, display_name) values
  ('a1a1a1a1-0000-0000-0000-00000000c0aa', 'a1a1a1a1-0000-0000-0000-0000000000aa', 'demo', 'Fuente demo en org real'),
  ('a1a1a1a1-0000-0000-0000-00000000c0ee', 'a1a1a1a1-0000-0000-0000-0000000000aa', 'metricool', 'Fuente real'),
  ('a1a1a1a1-0000-0000-0000-00000000c0dd', 'a1a1a1a1-0000-0000-0000-0000000000dd', 'demo', 'Fuente demo');

-- 1. Publicaciones y mediciones: la base fija is_synthetic según la organización.
select t_expect_error($$insert into public.social_posts (organization_id, data_source_id, platform, external_id, body, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'a1a1a1a1-0000-0000-0000-00000000c0aa', 'instagram', 'p-real-synth', 'x', true)$$,
  'una organización real no puede escribir publicaciones sintéticas (aunque la fuente sea demo)');
insert into public.social_posts (id, organization_id, data_source_id, platform, external_id, body, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000e00aa', 'a1a1a1a1-0000-0000-0000-0000000000aa', 'a1a1a1a1-0000-0000-0000-00000000c0ee', 'instagram', 'p-real', 'x', false),
  ('a1a1a1a1-0000-0000-0000-0000000e00dd', 'a1a1a1a1-0000-0000-0000-0000000000dd', 'a1a1a1a1-0000-0000-0000-00000000c0dd', 'instagram', 'p-demo', 'x', true);
select t_assert((select is_synthetic from public.social_posts where external_id = 'p-demo'),
  'una publicación sintética de organización demo se conserva');
select t_expect_error($$insert into public.social_posts (organization_id, data_source_id, platform, external_id, body, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'a1a1a1a1-0000-0000-0000-00000000c0dd', 'instagram', 'p-demo-real', 'x', false)$$,
  'una organización demo sigue rechazando contenido no sintético (0006: no se reclasifica en silencio)');
select t_expect_error($$update public.social_posts set is_synthetic = true where external_id = 'p-real'$$,
  'ni siquiera service_role puede marcar como sintético un dato real (update)');
select t_expect_error($$insert into public.post_metric_snapshots (organization_id, post_id, likes, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'a1a1a1a1-0000-0000-0000-0000000e00aa', 1, true)$$,
  'las mediciones de una organización real no pueden ser sintéticas');
insert into public.post_metric_snapshots (organization_id, post_id, likes, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'a1a1a1a1-0000-0000-0000-0000000e00dd', 1, true);

-- 2. Imágenes sintéticas propias: solo en organizaciones demo.
insert into public.post_media (organization_id, post_id, kind, source_url) values
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'a1a1a1a1-0000-0000-0000-0000000e00dd', 'image',
   'https://synthetic-media.heyfoxy.invalid/aurora/a01.jpg');
select t_assert((select count(*) = 1 from public.post_media where post_id = 'a1a1a1a1-0000-0000-0000-0000000e00dd'),
  'una organización demo puede usar imágenes sintéticas propias');
select t_expect_error($$insert into public.post_media (organization_id, post_id, kind, source_url) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'a1a1a1a1-0000-0000-0000-0000000e00aa', 'image',
   'https://synthetic-media.heyfoxy.invalid/aurora/a01.jpg')$$,
  'una organización real no puede apuntar a imágenes sintéticas');
select t_expect_error($$insert into public.post_media (organization_id, post_id, kind, source_url, preview_url) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'a1a1a1a1-0000-0000-0000-0000000e00aa', 'video',
   'https://scontent.cdninstagram.com/v.mp4', 'https://SYNTHETIC-MEDIA.heyfoxy.invalid/aurora/a01.jpg')$$,
  'tampoco como miniatura (sin distinguir mayúsculas)');

-- 3. Brand Brain y memoria editados por usuarios: la marca la decide la base.
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', false);
set role authenticated;
insert into public.brand_contexts (organization_id, identity, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', '{"name":"Real"}', true);
insert into public.brand_memory (organization_id, kind, title, body, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000aa', 'learning', 'Aprendizaje real', 'x', true);
update public.brand_contexts set is_synthetic = true where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000aa';
select t_expect_error($$update public.organizations set is_demo = true where id = 'a1a1a1a1-0000-0000-0000-0000000000aa'$$,
  'un owner no puede convertir su organización real en demo');
reset role;
select t_assert((select not is_synthetic from public.brand_contexts where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000aa'),
  'el owner de una organización real no puede marcar su Brand Brain como sintético');
select t_assert((select not bool_or(is_synthetic) from public.brand_memory where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000aa'),
  'ni sus aprendizajes');
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.brand_contexts (organization_id, identity, is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000dd', '{"name":"Demo"}', false);
reset role;
select t_assert((select is_synthetic from public.brand_contexts where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000dd'),
  'el Brand Brain guardado en una organización demo hereda la marca sintética');

-- 4. Consumo: la marca sintética solo vale en organizaciones demo.
create temp table r10 (id uuid);
grant all on r10 to service_role;
set role service_role;
insert into r10 select reservation_id from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000aa', null,
  'req-real-0001', 'ask', 'claude-sonnet-5-5', 0.01, true, 15, 0.005, 40, 2);
select t_assert((select not input_is_synthetic from public.ai_reservations where request_id = 'req-real-0001'),
  'una reserva de organización real marcada como sintética se registra como real');
select public.hf_ai_release((select id from r10));
select public.hf_ai_note('a1a1a1a1-0000-0000-0000-0000000000aa', null, 'ask', 'local', 'reglas', 'fallback', false, true, null);
select t_assert((select not bool_or(input_is_synthetic) from public.ai_usage where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000aa'),
  'hf_ai_note tampoco acepta la marca sintética de una organización real');
reset role;

-- 5. Topes acumulados de campaña (no se reinician con el mes).
insert into public.usage_budgets (organization_id, ai_monthly_usd, ai_daily_items, ai_campaign_usd, ai_campaign_calls, ai_campaign_since)
  values ('a1a1a1a1-0000-0000-0000-0000000000dd', 30, 2000, 0.10, 3, now() - interval '40 days');
-- Consumo de hace 35 días (otro mes, dentro de la campaña) y uno anterior a la campaña.
insert into public.ai_usage (organization_id, task, provider, model, input_tokens, output_tokens, cost_usd, cache_hit, created_at, status, input_is_synthetic) values
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'ask', 'anthropic', 'claude-sonnet-5-5', 10, 10, 0.06, false, now() - interval '35 days', 'ok', true),
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'ask', 'anthropic', 'claude-sonnet-5-5', 10, 10, 5.00, false, now() - interval '60 days', 'ok', true),
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'ask', 'local', 'reglas', 0, 0, 0, false, now() - interval '1 day', 'fallback', true),
  ('a1a1a1a1-0000-0000-0000-0000000000dd', 'ask', 'anthropic', 'claude-sonnet-5-5', 0, 0, 0, true, now() - interval '1 day', 'ok', true);
set role service_role;
select t_assert((select code = 'campaign_budget' from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-demo-0001', 'ask', 'claude-sonnet-5-5', 0.05, true, 15, 50, 40, 5)),
  'el tope de campaña suma el consumo de meses anteriores dentro de la campaña');
select t_assert((select code = 'ok' from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-demo-0002', 'ask', 'claude-sonnet-5-5', 0.03, true, 15, 50, 40, 5)),
  'el consumo anterior a la campaña no cuenta');
reset role;
-- 3 llamadas reales de campaña: 1 histórica + 1 reservada + 1 más → la cuarta se rechaza.
update public.usage_budgets set ai_campaign_usd = 1 where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000dd';
set role service_role;
select t_assert((select code = 'ok' from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-demo-0004', 'ask', 'claude-sonnet-5-5', 0.001, true, 15, 50, 40, 5)),
  'tercera llamada real de la campaña (respaldos y caché no cuentan)');
select t_assert((select code = 'campaign_calls' from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-demo-0005', 'ask', 'claude-sonnet-5-5', 0.001, true, 15, 50, 40, 5)),
  'tope de llamadas reales de la campaña');
reset role;
select t_assert((select count(*) = 0 from public.ai_reservations where request_id in ('req-demo-0001', 'req-demo-0005')),
  'las solicitudes rechazadas no dejan reserva');
-- 6. Latencias: se registran con la liquidación; el código anterior (10 parámetros) sigue valiendo.
create temp table r11 (id uuid);
grant all on r11 to service_role;
update public.usage_budgets set ai_campaign_usd = null, ai_campaign_calls = null where organization_id = 'a1a1a1a1-0000-0000-0000-0000000000dd';
set role service_role;
insert into r11 select reservation_id from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-lat-0001', 'ask', 'claude-sonnet-5-5', 0.001, true, 15, 50, 40, 5);
select public.hf_ai_settle(p_reservation => (select id from r11), p_provider => 'anthropic', p_status => 'ok', p_input => 10,
  p_output => 10, p_cache_read => 0, p_cache_write => 0, p_cost => 0.001, p_brand_version => 1, p_prompt_version => 'x',
  p_latency_ms => 4200, p_first_token_ms => 900);
delete from r11;
insert into r11 select reservation_id from public.hf_ai_reserve('a1a1a1a1-0000-0000-0000-0000000000dd', null,
  'req-lat-0002', 'ask', 'claude-sonnet-5-5', 0.001, true, 15, 50, 40, 5);
select public.hf_ai_settle(p_reservation => (select id from r11), p_provider => 'anthropic', p_status => 'ok', p_input => 10,
  p_output => 10, p_cache_read => 0, p_cache_write => 0, p_cost => 0.001, p_brand_version => 1, p_prompt_version => 'x');
reset role;
select t_assert((select latency_ms = 4200 and first_token_ms = 900 from public.ai_usage where request_id = 'req-lat-0001'),
  'la liquidación registra la latencia total y hasta el primer fragmento');
select t_assert((select latency_ms is null from public.ai_usage where request_id = 'req-lat-0002'),
  'la llamada con los diez parámetros de 0009 sigue funcionando (latencia opcional)');
\echo 'MIGRATION 0010 TESTS PASSED'
