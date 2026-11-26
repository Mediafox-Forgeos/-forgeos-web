-- Hey Foxy — pruebas de la migración 0007 (Brand Brain, memoria estratégica, caché, ai_kill_switch).
\set QUIET on
create or replace function public.t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function public.t_expect_error(stmt text, msg text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (rechazado: %)', msg, sqlerrm; return; end;
raise exception 'ASSERT FAILED (se esperaba error): %', msg; end $$;
grant execute on function public.t_assert(boolean, text), public.t_expect_error(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'owner-a7@demo.test'),
  ('a7000000-0000-0000-0000-000000000002', 'analyst-a7@demo.test'),
  ('a7000000-0000-0000-0000-000000000003', 'viewer-a7@demo.test'),
  ('b7000000-0000-0000-0000-000000000001', 'owner-b7@demo.test');
insert into public.organizations (id, name, slug, is_demo) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'Org A7', 'org-a7', false),
  ('b7b7b7b7-0000-0000-0000-000000000000', 'Org B7', 'org-b7', false);
insert into public.memberships (organization_id, user_id, role) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000001', 'owner'),
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000002', 'analyst'),
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7000000-0000-0000-0000-000000000003', 'viewer'),
  ('b7b7b7b7-0000-0000-0000-000000000000', 'b7000000-0000-0000-0000-000000000001', 'owner');
insert into public.data_sources (id, organization_id, provider, display_name, status) values
  ('b7b7b7b7-0000-0000-0000-0000000000d1', 'b7b7b7b7-0000-0000-0000-000000000000', 'metricool', 'M B7', 'connected');
insert into public.social_posts (id, organization_id, data_source_id, platform, external_id) values
  ('b7b7b7b7-0000-0000-0000-0000000000e1', 'b7b7b7b7-0000-0000-0000-000000000000', 'b7b7b7b7-0000-0000-0000-0000000000d1', 'instagram', 'b7-1');
insert into public.brand_contexts (organization_id, identity) values
  ('b7b7b7b7-0000-0000-0000-000000000000', '{"name":"Marca B"}');
insert into public.content_intel_cache (organization_id, subject_type, subject_key, input_hash, provider, model, prompt_version, output, input_is_synthetic) values
  ('b7b7b7b7-0000-0000-0000-000000000000', 'post', 'p', repeat('a', 40), 'local', 'reglas', 'v1', '{"x":1}', true);

select t_assert((select enabled = false from public.hf_runtime_flags where flag = 'ai_kill_switch'), 'interruptor de IA creado y apagado');
select t_expect_error($$insert into public.hf_runtime_flags (flag) values ('otro')$$, 'solo flags conocidos');
select t_expect_error($$insert into public.brand_contexts (organization_id, campaigns) values ('a7a7a7a7-0000-0000-0000-000000000000', '{}')$$,
  'campañas debe ser una lista');

-- Owner de A: crea y edita; la versión sube y queda el autor.
select set_config('request.jwt.claim.sub', 'a7000000-0000-0000-0000-000000000001', false);
set role authenticated;
insert into public.brand_contexts (organization_id, identity, strategy) values
  ('a7a7a7a7-0000-0000-0000-000000000000', '{"name":"Marca A"}', '{"pillars":[{"name":"Prevención"}]}');
update public.brand_contexts set identity = '{"name":"Marca A","tone":"cercano"}' where organization_id = 'a7a7a7a7-0000-0000-0000-000000000000';
select t_assert((select version = 2 and updated_by = 'a7000000-0000-0000-0000-000000000001' from public.brand_contexts
                 where organization_id = 'a7a7a7a7-0000-0000-0000-000000000000'), 'owner edita: versión 2 y autor registrado');
select t_assert((select count(*) from public.brand_contexts) = 1, 'A ve solo su contexto');
select t_assert((select count(*) from public.content_intel_cache) = 0, 'A no ve la caché de B');
update public.brand_contexts set identity = '{}' where organization_id = 'b7b7b7b7-0000-0000-0000-000000000000';
select t_assert((select count(*) from public.brand_contexts where organization_id = 'b7b7b7b7-0000-0000-0000-000000000000') = 0,
  'el contexto de B no es visible para A');
insert into public.brand_memory (organization_id, kind, title, body) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'learning', 'Los reels educativos rinden más', 'Evidencia: 3 reels');
select t_expect_error($$insert into public.brand_memory (organization_id, kind, title, body, status) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'learning', 'Validado directo', 'x', 'validated')$$, 'nadie inserta memoria ya validada');
select t_expect_error($$insert into public.brand_memory (organization_id, kind, title, body, source_post_id) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'learning', 'Evidencia ajena', 'x', 'b7b7b7b7-0000-0000-0000-0000000000e1')$$,
  'la evidencia no puede ser una publicación de otra organización');
update public.brand_memory set status = 'validated' where organization_id = 'a7a7a7a7-0000-0000-0000-000000000000';
select t_assert((select validated_by = 'a7000000-0000-0000-0000-000000000001' and validated_at is not null
                 from public.brand_memory where organization_id = 'a7a7a7a7-0000-0000-0000-000000000000'), 'validación humana registrada');
select t_expect_error($$insert into public.content_intel_cache (organization_id, subject_type, subject_key, input_hash, provider, model, prompt_version, output, input_is_synthetic)
  values ('a7a7a7a7-0000-0000-0000-000000000000', 'post', 'p', repeat('b', 40), 'x', 'y', 'v', '{}', true)$$, 'authenticated no escribe la caché');
select t_expect_error($$select * from public.hf_runtime_flags$$, 'authenticated no lee el interruptor de IA');
reset role;

select t_assert((select identity->>'name' = 'Marca B' from public.brand_contexts where organization_id = 'b7b7b7b7-0000-0000-0000-000000000000'),
  'el intento de A no modificó el contexto de B (RLS)');

-- Analyst de A: propone memoria, no edita el contexto ni valida.
select set_config('request.jwt.claim.sub', 'a7000000-0000-0000-0000-000000000002', false);
set role authenticated;
insert into public.brand_memory (organization_id, kind, title, body) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'recommendation_accepted', 'Probar CTA de agenda', 'Propuesta');
select t_assert((select count(*) from public.brand_memory where status = 'proposed') = 1, 'analyst propone memoria');
update public.brand_contexts set identity = '{}' where organization_id = 'a7a7a7a7-0000-0000-0000-000000000000';
select t_assert((select identity->>'tone' = 'cercano' from public.brand_contexts), 'analyst no modifica el contexto (RLS)');
update public.brand_memory set status = 'validated' where status = 'proposed';
select t_assert((select count(*) from public.brand_memory where status = 'proposed') = 1, 'analyst no valida memoria (RLS)');
reset role;

-- Viewer de A: solo lectura.
select set_config('request.jwt.claim.sub', 'a7000000-0000-0000-0000-000000000003', false);
set role authenticated;
select t_assert((select count(*) from public.brand_contexts) = 1, 'viewer lee el contexto');
select t_expect_error($$insert into public.brand_memory (organization_id, kind, title, body) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'learning', 'No permitido', 'x')$$, 'viewer no propone memoria');
reset role;

set role anon;
select t_expect_error($$select count(*) from public.brand_contexts$$, 'anon sin acceso al contexto');
reset role;

select t_assert((select relrowsecurity from pg_class where oid = 'public.brand_contexts'::regclass)
                and (select relrowsecurity from pg_class where oid = 'public.brand_memory'::regclass)
                and (select relrowsecurity from pg_class where oid = 'public.content_intel_cache'::regclass), 'RLS activa en las tres tablas');
select t_assert(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public'
                 and table_name in ('brand_contexts','brand_memory','content_intel_cache') and grantee in ('anon','PUBLIC')),
  'anon y PUBLIC sin privilegios');
select t_assert((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
                 where table_schema = 'public' and table_name = 'content_intel_cache' and grantee = 'authenticated') = 'SELECT',
  'authenticated: solo SELECT en la caché');
select t_assert(not has_function_privilege('authenticated', 'public.hf_brand_context_version()', 'execute'), 'función de versión no ejecutable');
\echo 'MIGRATION 0007 TESTS PASSED'
