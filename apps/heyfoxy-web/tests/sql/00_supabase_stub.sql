-- Stub mínimo compatible con Supabase para pruebas locales (NO es migración).
-- Reproduce roles anon/authenticated/service_role, auth.users y auth.uid().
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
-- Misma definición que auth.uid() en heyfoxy-qa (leída el 2026-11-14).
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Privilegios por defecto REALES de heyfoxy-qa para objetos creados por `postgres`
-- (pg_default_acl leído el 2026-11-14): tablas -> solo TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- para anon/authenticated/service_role; secuencias y funciones -> nada (ni PUBLIC).
-- La migración 0004 no depende de esto: revoca todo y concede explícitamente. Para probar
-- el modelo antiguo (ALL por defecto), exportar HF_STUB_LEGACY_ACL=1 en test-db.sh.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public grant truncate, references, trigger on tables to anon, authenticated, service_role;
do $$ begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges for role postgres in schema public grant maintain on tables to anon, authenticated, service_role';
  end if;
end $$;
