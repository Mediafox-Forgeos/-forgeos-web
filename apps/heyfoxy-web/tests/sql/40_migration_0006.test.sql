-- Hey Foxy — pruebas de la migración 0006 (medios, métricas, estado de sync, Storage).
\set QUIET on
create or replace function public.t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function public.t_expect_error(stmt text, msg text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (rechazado: %)', msg, sqlerrm; return; end;
raise exception 'ASSERT FAILED (se esperaba error): %', msg; end $$;
grant execute on function public.t_assert(boolean, text), public.t_expect_error(text, text) to authenticated, anon;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@demo.test'),
  ('b0000000-0000-0000-0000-000000000001', 'owner-b@demo.test');
insert into public.organizations (id, name, slug, is_demo) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Org A', 'org-a', false),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B', 'org-b', false);
insert into public.memberships (organization_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'owner');
insert into public.data_sources (id, organization_id, provider, display_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000000', 'metricool', 'Metricool A', 'connected'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'metricool', 'Metricool B', 'connected');
insert into public.social_posts (id, organization_id, data_source_id, platform, external_id, content_type, author_display) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'instagram', 'ig-1', 'carousel', 'Marca A'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000d1', 'facebook', 'fb-1', 'image', 'Marca B');
insert into public.post_media (organization_id, post_id, position, kind, source_url, copy_allowed, stored_object_path, retention_until) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 0, 'image', 'https://cdn.example/a0.jpg', true, 'aaaaaaaa-0000-0000-0000-000000000000/ig-1/0.webp', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 1, 'video', 'https://cdn.example/a1.mp4', false, null, now() + interval '89 days'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000e1', 0, 'image', 'https://cdn.example/b0.jpg', false, null, null);
insert into storage.objects (bucket_id, name) values
  ('hf-media', 'aaaaaaaa-0000-0000-0000-000000000000/ig-1/0.webp'),
  ('hf-media', 'bbbbbbbb-0000-0000-0000-000000000000/fb-1/0.webp');
insert into public.post_metric_snapshots (organization_id, post_id, likes, impressions, impressions_unique, interactions, saves, video_views, engagement, reactions)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 10, 100, 80, 15, 2, null, 0.1875, '{"like":8,"love":2}');

-- Restricciones y guardas (como servidor)
select t_expect_error($$insert into public.post_media (organization_id, post_id, kind, source_url)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'image', 'https://x/y.jpg')$$,
  'medio de A sobre publicación de B (guarda multiempresa)');
select t_expect_error($$insert into public.post_media (organization_id, post_id, position, kind, source_url)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 5, 'image', 'http://inseguro/y.jpg')$$,
  'URL no https');
select t_expect_error($$insert into public.post_media (organization_id, post_id, position, kind, source_url, copy_allowed, stored_object_path)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 6, 'image', 'https://x/y.jpg', true, 'bbbbbbbb-0000-0000-0000-000000000000/x.webp')$$,
  'ruta de Storage fuera de la carpeta de la organización');
select t_expect_error($$insert into public.post_media (organization_id, post_id, position, kind, source_url, copy_allowed, stored_object_path)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 7, 'image', 'https://x/y.jpg', false, 'aaaaaaaa-0000-0000-0000-000000000000/x.webp')$$,
  'copia sin autorización de copia (copy_allowed = false)');
select t_expect_error($$insert into public.post_media (organization_id, post_id, position, kind, source_url, copy_allowed, stored_object_path)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 8, 'video', 'https://x/v.mp4', true, 'aaaaaaaa-0000-0000-0000-000000000000/v.mp4')$$,
  'copia de video sin miniatura (no se almacenan videos completos)');
select t_expect_error($$insert into public.social_posts (organization_id, data_source_id, platform, external_id, content_type)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'x', 'x-9', 'hologram')$$,
  'tipo de contenido desconocido');

-- Datos reales nunca en organizaciones demo; una marca, una organización; interruptor global
insert into public.organizations (id, name, slug, is_demo) values
  ('dddddddd-0000-0000-0000-000000000000', 'Org Demo', 'org-demo', true);
insert into public.data_sources (id, organization_id, provider, display_name, status) values
  ('dddddddd-0000-0000-0000-0000000000d0', 'dddddddd-0000-0000-0000-000000000000', 'demo', 'Demo', 'connected'),
  ('dddddddd-0000-0000-0000-0000000000d1', 'dddddddd-0000-0000-0000-000000000000', 'metricool', 'Metricool demo', 'not_connected');
select t_expect_error($$update public.data_sources set status = 'connected' where id = 'dddddddd-0000-0000-0000-0000000000d1'$$,
  'fuente real no se conecta en una organización demo');
select t_expect_error($$update public.data_sources set external_account_ref = '700001' where id = 'dddddddd-0000-0000-0000-0000000000d1'$$,
  'organización demo no se vincula a una marca real');
select t_expect_error($$insert into public.data_sources (organization_id, provider, display_name, status)
  values ('dddddddd-0000-0000-0000-000000000000', 'meta_graph', 'Meta demo', 'connected')$$,
  'fuente real conectada en demo rechazada también al insertar');
insert into public.social_posts (organization_id, data_source_id, platform, external_id, is_synthetic) values
  ('dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000d0', 'instagram', 'demo-1', true);
select t_assert((select count(*) from public.social_posts where organization_id = 'dddddddd-0000-0000-0000-000000000000') = 1,
  'contenido sintético sigue permitido en la organización demo');
select t_expect_error($$insert into public.social_posts (organization_id, data_source_id, platform, external_id, is_synthetic)
  values ('dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000d1', 'instagram', 'real-1', false)$$,
  'publicación real rechazada en organización demo');
select t_expect_error($$insert into public.social_comments (organization_id, data_source_id, platform, external_id, body, published_at, content_hash, is_synthetic)
  values ('dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000d1', 'instagram', 'rc-1', 'x', now(), 'h', false)$$,
  'comentario real rechazado en organización demo');
select t_expect_error($$insert into public.post_metric_snapshots (organization_id, post_id, likes, is_synthetic)
  select 'dddddddd-0000-0000-0000-000000000000', id, 1, false from public.social_posts where external_id = 'demo-1'$$,
  'métrica real rechazada en organización demo');
update public.data_sources set external_account_ref = '700001' where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
select t_expect_error($$update public.data_sources set external_account_ref = '700001' where id = 'bbbbbbbb-0000-0000-0000-0000000000d1'$$,
  'la misma marca no se vincula a dos organizaciones');
select t_assert((select not enabled from public.hf_runtime_flags where flag = 'sync_kill_switch'), 'interruptor global creado y apagado');
select t_expect_error($$insert into public.hf_runtime_flags (flag) values ('otro_flag')$$, 'solo flags conocidos');
select t_expect_error($$update public.data_sources set last_sync_status = 'inventado' where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'$$,
  'estado de sync desconocido rechazado');
update public.data_sources set last_sync_status = 'stopped' where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';
update public.data_sources set last_sync_status = null where id = 'aaaaaaaa-0000-0000-0000-0000000000d1';

-- Como usuario de A
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);
set role authenticated;
select t_assert((select count(*) from public.post_media) = 2, 'A ve solo sus 2 medios');
select t_assert((select count(*) from public.post_media where organization_id = 'bbbbbbbb-0000-0000-0000-000000000000') = 0, 'A no ve medios de B');
select t_assert((select count(*) from storage.objects where bucket_id = 'hf-media') = 1, 'A ve solo su objeto de Storage');
select t_expect_error($$insert into public.post_media (organization_id, post_id, position, kind, source_url)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 9, 'image', 'https://x/z.jpg')$$,
  'authenticated no inserta medios');
select t_expect_error($$update public.post_media set source_url = 'https://x/otra.jpg'$$, 'authenticated no modifica medios');
select t_expect_error($$update public.data_sources set last_sync_status = 'succeeded'$$, 'authenticated no escribe el estado de sync');
select t_expect_error($$update public.data_sources set sync_cursor = '{}'$$, 'authenticated no escribe el cursor');
select t_expect_error($$select * from public.hf_purge_expired_media()$$, 'authenticated no ejecuta la purga');
select t_expect_error($$insert into storage.objects (bucket_id, name) values ('hf-media', 'aaaaaaaa-0000-0000-0000-000000000000/x.webp')$$,
  'authenticated no sube a Storage');
select t_assert((select last_sync_status is null and api_calls_today = 0 and max_api_calls_per_day = 500
                 from public.data_sources where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'), 'A lee el estado de su fuente');
select t_assert((select reactions->>'like' = '8' and impressions_unique = 80 from public.post_metric_snapshots limit 1),
  'métricas nuevas legibles por miembros');
select t_expect_error($$select * from public.hf_runtime_flags$$, 'authenticated no lee el interruptor global');
select t_expect_error($$update public.hf_runtime_flags set enabled = true$$, 'authenticated no activa el interruptor global');
reset role;

-- Como usuario de B
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', false);
set role authenticated;
select t_assert((select count(*) from public.post_media) = 1, 'B ve solo su medio');
select t_assert((select count(*) from storage.objects where name like 'aaaaaaaa%') = 0, 'B no ve objetos de A');
reset role;

-- Sin sesión (anon)
set role anon;
select t_expect_error($$select count(*) from public.post_media$$, 'anon sin acceso a medios');
reset role;

-- Purga por retención (servidor)
select t_assert((select count(*) from public.hf_purge_expired_media()) = 1, 'la purga borra 1 medio vencido');
select t_assert((select count(*) from public.post_media) = 2, 'quedan los medios vigentes');
select t_assert(not exists (select 1 from public.post_media where stored_object_path = 'aaaaaaaa-0000-0000-0000-000000000000/ig-1/0.webp'),
  'el medio vencido ya no existe');
-- Borrado en la fuente: borrar la publicación elimina sus medios.
delete from public.social_posts where id = 'aaaaaaaa-0000-0000-0000-0000000000e1';
select t_assert((select count(*) from public.post_media where organization_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 0,
  'borrar la publicación borra sus medios');

-- Contrato de privilegios de los objetos nuevos
select t_assert((select relrowsecurity from pg_class where oid = 'public.post_media'::regclass), 'RLS activa en post_media');
select t_assert((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
                 where table_schema = 'public' and table_name = 'post_media' and grantee = 'authenticated') = 'SELECT',
  'authenticated: solo SELECT en post_media');
select t_assert(not exists (select 1 from information_schema.role_table_grants
                 where table_schema = 'public' and table_name = 'post_media' and grantee in ('anon', 'PUBLIC')),
  'anon y PUBLIC sin privilegios en post_media');
select t_assert((select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges
                 where table_schema = 'public' and table_name = 'data_sources' and grantee = 'authenticated' and privilege_type = 'UPDATE')
                = 'display_name,ingestion_paused,max_items_per_day,poll_interval_minutes',
  'authenticated: columnas actualizables de data_sources sin cambios');
select t_assert(not has_function_privilege('authenticated', 'public.hf_purge_expired_media(timestamptz)', 'execute')
                and has_function_privilege('service_role', 'public.hf_purge_expired_media(timestamptz)', 'execute'),
  'purga ejecutable solo por service_role');
select t_assert((select not public from storage.buckets where id = 'hf-media'), 'bucket hf-media privado');
select t_assert((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
                 where table_schema = 'public' and table_name = 'hf_runtime_flags' and grantee = 'service_role') = 'SELECT,UPDATE',
  'service_role: solo SELECT y UPDATE en el interruptor global');
select t_assert(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public'
                 and table_name = 'hf_runtime_flags' and grantee in ('anon', 'PUBLIC', 'authenticated')),
  'nadie más tiene privilegios sobre el interruptor global');
select t_assert(not has_function_privilege('authenticated', 'public.hf_guard_real_data_org()', 'execute'),
  'guarda de datos reales no ejecutable por authenticated');
\echo 'MIGRATION 0006 TESTS PASSED'
