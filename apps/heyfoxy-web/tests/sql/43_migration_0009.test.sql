-- Hey Foxy — pruebas de la migración 0009 (consumo, reservas y presupuesto de IA).
\set QUIET on
create or replace function public.t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function public.t_expect_error(stmt text, msg text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (rechazado: %)', msg, sqlerrm; return; end;
raise exception 'ASSERT FAILED (se esperaba error): %', msg; end $$;
grant execute on function public.t_assert(boolean, text), public.t_expect_error(text, text) to authenticated, anon, service_role;

insert into auth.users (id, email) values
  ('a9000000-0000-0000-0000-000000000001', 'owner-a9@demo.test'),
  ('b9000000-0000-0000-0000-000000000001', 'owner-b9@demo.test');
insert into public.organizations (id, name, slug, is_demo) values
  ('a9a9a9a9-0000-0000-0000-000000000000', 'Org A9', 'org-a9', false),
  ('b9b9b9b9-0000-0000-0000-000000000000', 'Org B9', 'org-b9', true);
insert into public.memberships (organization_id, user_id, role) values
  ('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001', 'owner'),
  ('b9b9b9b9-0000-0000-0000-000000000000', 'b9000000-0000-0000-0000-000000000001', 'owner');
insert into public.usage_budgets (organization_id, ai_monthly_usd, ai_daily_items) values
  ('a9a9a9a9-0000-0000-0000-000000000000', 0.10, 50);

-- Servidor (service_role) reserva y liquida.
create temp table r (id uuid);
grant all on r to service_role;
set role service_role;
insert into r select reservation_id from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0001', 'ask', 'claude-sonnet-5-5', 0.04, false, 15, 5, 40, 2);
select t_assert((select count(*) = 1 from public.ai_reservations), 'la reserva queda registrada');
select t_assert((select code = 'duplicate' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0001', 'ask', 'claude-sonnet-5-5', 0.01, false, 15, 5, 40, 2)), 'una solicitud duplicada se rechaza');
select t_assert((select code = 'budget' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0002', 'ask', 'claude-sonnet-5-5', 0.07, false, 15, 5, 40, 2)), 'presupuesto: gastado + reservado + estimado no supera usage_budgets');
select t_assert((select code = 'ok' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0003', 'ask', 'claude-sonnet-5-5', 0.01, false, 15, 5, 40, 2)), 'una segunda reserva dentro del presupuesto se acepta');
select t_assert((select code = 'concurrency' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0004', 'ask', 'claude-sonnet-5-5', 0.001, false, 15, 5, 40, 2)), 'límite de llamadas simultáneas por organización');
select public.hf_ai_settle((select id from r), 'anthropic', 'ok', 1200, 300, 4000, 0, 0.0055, 3, 'gen_ask@test');
select t_assert((select count(*) = 1 and sum(cost_usd) = 0.0055 and bool_and(request_id = 'req-aaaa-0001' and brand_version = 3 and user_id is not null)
                 from public.ai_usage where organization_id = 'a9a9a9a9-0000-0000-0000-000000000000'), 'liquidar registra costo, tokens, versión de Brand Brain y autor');
select public.hf_ai_settle((select id from r), 'anthropic', 'ok', 1, 1, 0, 0, 1, null, 'x');
select t_assert((select count(*) = 1 from public.ai_usage where organization_id = 'a9a9a9a9-0000-0000-0000-000000000000'), 'liquidar dos veces no duplica el cobro');
select t_assert((select code = 'duplicate' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0001', 'ask', 'claude-sonnet-5-5', 0.001, false, 15, 5, 40, 2)), 'un id ya liquidado no se vuelve a cobrar');
select t_assert((select code = 'user_limit' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0005', 'ask', 'claude-sonnet-5-5', 0.001, false, 15, 5, 2, 5)), 'límite diario por usuario (usos + reservas)');
-- Pruebas sintéticas: tope global.
select t_assert((select code = 'synthetic_cap' from public.hf_ai_reserve('b9b9b9b9-0000-0000-0000-000000000000', 'b9000000-0000-0000-0000-000000000001',
  'req-bbbb-0001', 'content_analysis', 'claude-sonnet-5-5', 0.6, true, 15, 0.5, 40, 2)), 'tope total de pruebas sintéticas');
reset role;
-- Interruptor de emergencia.
update public.hf_runtime_flags set enabled = true where flag = 'ai_kill_switch';
set role service_role;
select t_assert((select code = 'kill_switch' from public.hf_ai_reserve('b9b9b9b9-0000-0000-0000-000000000000', 'b9000000-0000-0000-0000-000000000001',
  'req-bbbb-0002', 'ask', 'claude-sonnet-5-5', 0.001, true, 15, 5, 40, 2)), 'el interruptor ai_kill_switch bloquea nuevas reservas');
reset role;
update public.hf_runtime_flags set enabled = false where flag = 'ai_kill_switch';
-- Reservas caducadas se liberan.
update public.ai_reservations set expires_at = now() - interval '1 minute';
set role service_role;
select t_assert((select code = 'ok' from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', 'a9000000-0000-0000-0000-000000000001',
  'req-aaaa-0006', 'ask', 'claude-sonnet-5-5', 0.001, false, 15, 5, 40, 2)), 'las reservas caducadas se liberan');
select t_expect_error($$select * from public.hf_ai_reserve('a9a9a9a9-0000-0000-0000-000000000000', null, 'req-aaaa-0007', 'ask', 'm', 9, false, 15, 5, 40, 2)$$,
  'una estimación fuera de rango se rechaza');
reset role;

-- Usuarios autenticados: no reservan ni leen reservas; ven solo el consumo de su organización.
select set_config('request.jwt.claim.sub', 'b9000000-0000-0000-0000-000000000001', false);
set role authenticated;
select t_expect_error($$select * from public.hf_ai_reserve('b9b9b9b9-0000-0000-0000-000000000000', null, 'req-bbbb-0009', 'ask', 'm', 0, true, 15, 5, 40, 2)$$,
  'authenticated no puede reservar presupuesto');
select t_expect_error($$select * from public.ai_reservations$$, 'authenticated no lee reservas');
select t_assert((select count(*) = 0 from public.ai_usage where organization_id = 'a9a9a9a9-0000-0000-0000-000000000000'),
  'el consumo de otra organización no es visible (RLS)');
reset role;
select t_assert((select relrowsecurity from pg_class where oid = 'public.ai_reservations'::regclass), 'RLS activa en ai_reservations');
\echo 'MIGRATION 0009 TESTS PASSED'
