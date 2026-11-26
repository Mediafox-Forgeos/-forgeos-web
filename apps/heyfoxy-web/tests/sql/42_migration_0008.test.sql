-- Hey Foxy — pruebas de la migración 0008 (revisión humana de la memoria estratégica).
\set QUIET on
create or replace function public.t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function public.t_expect_error(stmt text, msg text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (rechazado: %)', msg, sqlerrm; return; end;
raise exception 'ASSERT FAILED (se esperaba error): %', msg; end $$;
grant execute on function public.t_assert(boolean, text), public.t_expect_error(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('a8000000-0000-0000-0000-000000000001', 'owner-a8@demo.test'),
  ('a8000000-0000-0000-0000-000000000002', 'analyst-a8@demo.test'),
  ('b8000000-0000-0000-0000-000000000001', 'owner-b8@demo.test');
insert into public.organizations (id, name, slug, is_demo) values
  ('a8a8a8a8-0000-0000-0000-000000000000', 'Org A8', 'org-a8', false),
  ('b8b8b8b8-0000-0000-0000-000000000000', 'Org B8', 'org-b8', false);
insert into public.memberships (organization_id, user_id, role) values
  ('a8a8a8a8-0000-0000-0000-000000000000', 'a8000000-0000-0000-0000-000000000001', 'owner'),
  ('a8a8a8a8-0000-0000-0000-000000000000', 'a8000000-0000-0000-0000-000000000002', 'analyst'),
  ('b8b8b8b8-0000-0000-0000-000000000000', 'b8000000-0000-0000-0000-000000000001', 'owner');
insert into public.brand_memory (id, organization_id, kind, title, body) values
  ('b8b8b8b8-0000-0000-0000-0000000000f1', 'b8b8b8b8-0000-0000-0000-000000000000', 'learning', 'Memoria de B', 'x');

-- Analyst propone; no revisa.
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.brand_memory (id, organization_id, kind, title, body) values
  ('a8a8a8a8-0000-0000-0000-0000000000f1', 'a8a8a8a8-0000-0000-0000-000000000000', 'learning', 'Aprendizaje 1', 'Propuesta 1'),
  ('a8a8a8a8-0000-0000-0000-0000000000f2', 'a8a8a8a8-0000-0000-0000-000000000000', 'learning', 'Aprendizaje 2', 'Propuesta 2'),
  ('a8a8a8a8-0000-0000-0000-0000000000f3', 'a8a8a8a8-0000-0000-0000-000000000000', 'learning', 'Aprendizaje 3', 'Propuesta 3');
select t_assert((select created_by = 'a8000000-0000-0000-0000-000000000002' and reviewed_by is null and review_note is null
                 from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f1'), 'el analyst propone y queda como autor');
select t_expect_error($$insert into public.brand_memory (organization_id, kind, title, body, status, review_note) values
  ('a8a8a8a8-0000-0000-0000-000000000000', 'learning', 'Rechazo directo', 'x', 'rejected', 'motivo')$$, 'nadie inserta memoria ya rechazada');
update public.brand_memory set status = 'rejected', review_note = 'No aplica' where id = 'a8a8a8a8-0000-0000-0000-0000000000f2';
select t_assert((select status = 'proposed' from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f2'),
  'el analyst no puede rechazar (RLS)');
reset role;

-- Owner revisa.
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', false);
set role authenticated;
update public.brand_memory set status = 'validated', review_note = 'Coincide con el piloto'
  where id = 'a8a8a8a8-0000-0000-0000-0000000000f1';
select t_assert((select validated_by = 'a8000000-0000-0000-0000-000000000001' and reviewed_by = validated_by
                        and reviewed_at is not null and review_note = 'Coincide con el piloto'
                 from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f1'), 'aprobación con autor, fecha y nota');
select t_expect_error($$update public.brand_memory set status = 'rejected' where id = 'a8a8a8a8-0000-0000-0000-0000000000f2'$$,
  'rechazar exige motivo');
select t_expect_error($$update public.brand_memory set status = 'rejected', review_note = 'no' where id = 'a8a8a8a8-0000-0000-0000-0000000000f2'$$,
  'el motivo tiene al menos 3 caracteres');
update public.brand_memory set status = 'rejected', review_note = 'Base de dos publicaciones: insuficiente'
  where id = 'a8a8a8a8-0000-0000-0000-0000000000f2';
select t_assert((select status = 'rejected' and reviewed_by = 'a8000000-0000-0000-0000-000000000001' and validated_at is null
                 from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f2'), 'rechazo con motivo y autor');
select t_expect_error($$update public.brand_memory set status = 'validated' where id = 'a8a8a8a8-0000-0000-0000-0000000000f2'$$,
  'un rechazo no se convierte en validación');
select t_expect_error($$update public.brand_memory set status = 'proposed' where id = 'a8a8a8a8-0000-0000-0000-0000000000f1'$$,
  'nada vuelve a propuesto');
select t_expect_error($$update public.brand_memory set title = 'Reescrito' where id = 'a8a8a8a8-0000-0000-0000-0000000000f3'$$,
  'el contenido propuesto es inmutable');
update public.brand_memory set review_note = 'Cambio silencioso' where id = 'a8a8a8a8-0000-0000-0000-0000000000f1';
select t_assert((select review_note = 'Coincide con el piloto' from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f1'),
  'la nota de una revisión no se reescribe sin cambio de estado');
update public.brand_memory set status = 'archived' where id = 'a8a8a8a8-0000-0000-0000-0000000000f1';
select t_assert((select status = 'archived' from public.brand_memory where id = 'a8a8a8a8-0000-0000-0000-0000000000f1'),
  'una memoria validada se puede archivar');
update public.brand_memory set status = 'rejected', review_note = 'Intento ajeno' where id = 'b8b8b8b8-0000-0000-0000-0000000000f1';
reset role;
select t_assert((select status = 'proposed' from public.brand_memory where id = 'b8b8b8b8-0000-0000-0000-0000000000f1'),
  'el owner de A no revisa la memoria de B (RLS)');
select t_assert((select relrowsecurity from pg_class where oid = 'public.brand_memory'::regclass), 'RLS sigue activa');
select t_assert(not has_function_privilege('authenticated', 'public.hf_guard_brand_memory_org()', 'execute'),
  'la función de guarda no es ejecutable por authenticated');
\echo 'MIGRATION 0008 TESTS PASSED'
