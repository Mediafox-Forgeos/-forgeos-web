-- Hey Foxy — pruebas de aislamiento multiempresa, RLS, FSM y guardas.
-- Se ejecuta con scripts/test-db.sh sobre un Postgres local efímero.
\set QUIET on

create or replace function public.t_assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function public.t_expect_error(stmt text, msg text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (rechazado: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'ASSERT FAILED (se esperaba error): %', msg;
end $$;

create or replace function public.t_affected(stmt text) returns integer
language plpgsql as $$
declare n integer;
begin
  execute stmt; get diagnostics n = row_count; return n;
end $$;

-- --------------------------------------------------------------------------
-- Seed (superusuario, equivale a service role)
-- --------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@demo.test'),
  ('a0000000-0000-0000-0000-000000000002', 'viewer-a@demo.test'),
  ('a0000000-0000-0000-0000-000000000003', 'responder-a@demo.test'),
  ('a0000000-0000-0000-0000-000000000004', 'admin-a@demo.test'),
  ('a0000000-0000-0000-0000-000000000005', 'analyst-a@demo.test'),
  ('b0000000-0000-0000-0000-000000000001', 'owner-b@demo.test'),
  ('c0000000-0000-0000-0000-000000000001', 'outsider@demo.test');

insert into public.organizations (id, name, slug, is_demo) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Demo Org A', 'demo-a', true),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Demo Org B', 'demo-b', true);

insert into public.memberships (organization_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'viewer'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'responder'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'analyst'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'owner');

insert into public.brands (id, organization_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Marca A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Marca B');

insert into public.data_sources (id, organization_id, provider, display_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'demo', 'Demo A', 'connected'),
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-000000000000', 'metricool', 'Metricool A', 'not_connected'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'demo', 'Demo B', 'connected');

insert into public.integration_credentials (organization_id, data_source_id, ciphertext, iv, auth_tag) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d2', '\x00', '\x00', '\x00');

insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'instagram', 'c-a-1', 'comentario A', now(), 'h1', true),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1', 'instagram', 'c-b-1', 'comentario B', now(), 'h2', true);

insert into public.source_coverage (organization_id, data_source_id, platform, data_kind, status, period_start) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'instagram', 'comments', 'complete', now() - interval '7 days'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1', 'instagram', 'comments', 'partial', now() - interval '7 days');

insert into public.alerts (id, organization_id, title, summary, severity, priority_score, review_status, dedupe_key, is_synthetic) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Alerta A', 's', 'critical', 91, 'pending', 'k-a', true),
  ('bbbbbbbb-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Alerta B', 's', 'high', 75, 'not_required', 'k-b', true);

insert into public.incidents (id, organization_id, title, severity, opened_by, is_synthetic) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Incidente A', 'high', 'a0000000-0000-0000-0000-000000000001', true),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Incidente B', 'high', 'b0000000-0000-0000-0000-000000000001', true);

insert into public.whatsapp_recipients (organization_id, display_name, phone_e164, opted_in_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Contacto ficticio A', '+570000000001', now()),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Contacto ficticio B', '+570000000002', now());

insert into public.audit_logs (organization_id, action, entity_type) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'seed', 'test'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'seed', 'test');

-- --------------------------------------------------------------------------
-- 1. Cobertura de RLS: toda tabla de public con organization_id tiene RLS
-- --------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relname like 't\_%'
  loop
    perform public.t_assert(r.relrowsecurity, 'RLS habilitado en ' || r.relname);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 2. Owner A: ve solo datos de A en todas las tablas multiempresa
-- --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$
declare r record; n_foreign integer; n_own integer;
begin
  for r in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'organization_id'
      and c.table_name not in ('integration_credentials')
  loop
    execute format('select count(*) filter (where organization_id <> %L), count(*) filter (where organization_id = %L) from public.%I',
                   'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', r.table_name)
      into n_foreign, n_own;
    perform public.t_assert(n_foreign = 0, 'owner A no ve filas ajenas en ' || r.table_name);
  end loop;
  perform public.t_assert((select count(*) from public.organizations) = 1, 'owner A ve exactamente 1 organización');
  perform public.t_assert((select count(*) from public.social_comments) = 1, 'owner A ve su comentario');
  perform public.t_assert((select count(*) from public.incident_events) = 1, 'owner A ve el evento opened de su incidente');
end $$;
select public.t_expect_error('select * from public.integration_credentials', 'owner A no puede leer credenciales cifradas');
select public.t_assert(public.t_affected($q$update public.organizations set name = 'hack' where id = 'bbbbbbbb-0000-0000-0000-000000000000'$q$) = 0,
                       'owner A no puede modificar la organización B');
select public.t_expect_error($q$update public.data_sources set status = 'connected' where id = 'aaaaaaaa-0000-0000-0000-0000000000d2'$q$,
                             'owner A no puede marcar una fuente como conectada (solo servidor)');
select public.t_assert(public.t_affected($q$update public.data_sources set ingestion_paused = true where id = 'aaaaaaaa-0000-0000-0000-0000000000d2'$q$) = 1,
                       'owner A sí puede pausar la ingesta de su fuente');
select public.t_expect_error($q$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000d2','instagram','x','x',now(),'x')$q$,
                             'usuarios no pueden insertar contenido (solo ingesta del servidor)');
select public.t_expect_error($q$insert into public.memberships (organization_id, user_id, role)
                              values ('bbbbbbbb-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','owner')$q$,
                             'owner A no puede auto-agregarse a la organización B');
select public.t_expect_error($q$update public.audit_logs set action = 'x'$q$, 'audit_logs es append-only');
reset role;

-- --------------------------------------------------------------------------
-- 3. Usuario externo y anon: no ven nada
-- --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$
declare r record; n integer;
begin
  for r in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'organization_id'
      and c.table_name not in ('integration_credentials')
  loop
    execute format('select count(*) from public.%I', r.table_name) into n;
    perform public.t_assert(n = 0, 'usuario sin membresía no ve filas en ' || r.table_name);
  end loop;
  perform public.t_assert((select count(*) from public.organizations) = 0, 'usuario sin membresía no ve organizaciones');
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.t_expect_error('select * from public.social_comments', 'anon no puede leer comentarios');
select public.t_expect_error('select * from public.organizations', 'anon no puede leer organizaciones');
reset role;

-- --------------------------------------------------------------------------
-- 4. Roles dentro de A
-- --------------------------------------------------------------------------
-- viewer
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
set role authenticated;
select public.t_expect_error($q$insert into public.incidents (organization_id, title, severity, opened_by)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','x','high','a0000000-0000-0000-0000-000000000002')$q$,
                             'viewer no puede abrir incidentes');
select public.t_assert(public.t_affected($q$update public.alerts set review_status = 'confirmed', reviewed_by = 'a0000000-0000-0000-0000-000000000002', reviewed_at = now()$q$) = 0,
                       'viewer no puede revisar alertas');
select public.t_assert((select count(*) from public.whatsapp_recipients) = 0, 'viewer no ve teléfonos (PII)');
select public.t_assert((select count(*) from public.audit_logs) = 0, 'viewer no ve auditoría');
reset role;

-- admin: no puede crear owners
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
set role authenticated;
select public.t_expect_error($q$update public.memberships set role = 'owner' where user_id = 'a0000000-0000-0000-0000-000000000004'$q$,
                             'admin no puede auto-promoverse a owner');
reset role;

-- analyst: revisión humana de alerta crítica
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000005', false);
set role authenticated;
select public.t_assert(public.t_affected($q$update public.alerts set review_status = 'confirmed', reviewed_by = 'a0000000-0000-0000-0000-000000000005', reviewed_at = now() where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$q$) = 1,
                       'analyst puede confirmar alerta crítica de su organización');
select public.t_assert(public.t_affected($q$update public.alerts set review_status = 'confirmed', reviewed_by = 'a0000000-0000-0000-0000-000000000005', reviewed_at = now() where id = 'bbbbbbbb-0000-0000-0000-0000000000a1'$q$) = 0,
                       'analyst A no puede revisar alertas de B');
select public.t_expect_error($q$update public.alerts set severity = 'info' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$q$,
                             'analyst no puede rebajar la severidad calculada');
reset role;

-- responder: incidentes + FSM
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
set role authenticated;
select public.t_expect_error($q$insert into public.incidents (organization_id, title, severity, opened_by)
                              values ('bbbbbbbb-0000-0000-0000-000000000000','x','high','a0000000-0000-0000-0000-000000000003')$q$,
                             'responder A no puede abrir incidentes en B');
select public.t_expect_error($q$update public.incidents set status = 'resolved' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$q$,
                             'FSM: open -> resolved no permitido');
select public.t_assert(public.t_affected($q$update public.incidents set status = 'acknowledged', owner_user_id = 'a0000000-0000-0000-0000-000000000003' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$q$) = 1,
                       'FSM: open -> acknowledged + asignación');
select public.t_expect_error($q$update public.incidents set owner_user_id = 'b0000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$q$,
                             'no se puede asignar un incidente a un usuario de otra organización');
select public.t_expect_error($q$update public.incidents set owner_user_id = 'a0000000-0000-0000-0000-000000000002' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$q$,
                             'no se puede asignar un incidente a un viewer');
update public.incidents set status = 'investigating' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
update public.incidents set status = 'responding' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
update public.incidents set status = 'resolved' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
select public.t_expect_error($q$update public.incidents set status = 'closed' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$q$,
                             'cierre exige resumen de resolución');
update public.incidents set status = 'closed', resolution_summary = 'Respuesta publicada y tema estabilizado' where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
select public.t_assert((select closed_at is not null from public.incidents where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'), 'cierre registra closed_at');
select public.t_assert((select count(*) from public.incident_events where incident_id = 'aaaaaaaa-0000-0000-0000-0000000000e1') = 7,
                       'historial completo: opened, assigned, ack, investigating, responding, resolved, closed');
insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, body)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-000000000003', 'note', 'nota');
select public.t_expect_error($q$insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, to_status)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000e1','a0000000-0000-0000-0000-000000000003','status_changed','closed')$q$,
                             'usuarios no pueden falsificar eventos de estado');
select public.t_expect_error($q$update public.incident_events set body = 'x'$q$, 'incident_events es append-only');
select public.t_expect_error($q$delete from public.incident_events$q$, 'incident_events no se puede borrar');
reset role;

-- --------------------------------------------------------------------------
-- 5. Guardas de integridad (aplican incluso al servidor)
-- --------------------------------------------------------------------------
select public.t_expect_error($q$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-0000000000d1','instagram','x','x',now(),'x',true)$q$,
                             'servidor: referencia cruzada org A + fuente B rechazada');
select public.t_expect_error($q$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000d1','instagram','x2','x',now(),'x',false)$q$,
                             'proveedor demo no puede escribir datos marcados como reales');
select public.t_expect_error($q$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000d2','instagram','x3','x',now(),'x',true)$q$,
                             'proveedor real no puede escribir datos sintéticos');
select public.t_expect_error($q$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000d1','instagram','c-a-1','dup',now(),'h1',true)$q$,
                             'dedupe: mismo external_id por fuente rechazado');
select public.t_expect_error($q$insert into public.alerts (organization_id, title, summary, severity, priority_score, dedupe_key)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','x','x','critical',95,'k-x')$q$,
                             'alerta crítica sin revisión humana rechazada');
select public.t_expect_error($q$insert into public.alerts (organization_id, title, summary, severity, priority_score, review_status, dedupe_key)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','x','x','high',80,'not_required','k-a')$q$,
                             'dedupe de alertas por dedupe_key');
select public.t_expect_error($q$insert into public.whatsapp_recipients (organization_id, display_name, phone_e164)
                              values ('aaaaaaaa-0000-0000-0000-000000000000','x','3001234567')$q$,
                             'teléfono debe estar en formato E.164');

select 'ALL ISOLATION TESTS PASSED' as result;
