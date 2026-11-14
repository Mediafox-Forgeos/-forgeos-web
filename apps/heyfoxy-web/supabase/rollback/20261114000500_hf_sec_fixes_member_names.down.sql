-- Hey Foxy — ROLLBACK de 0005. NO es una migración: se ejecuta solo con GO explícito,
-- y solo en heyfoxy-qa. Devuelve el esquema exactamente al estado de 0004 (contrato
-- de 0004: 9 funciones, 18 triggers, organizations UPDATE a nivel de tabla).
-- Advertencia: display_name se pierde (dato no crítico; el seed lo regenera).
begin;
drop trigger if exists incidents_refs_guard on public.incidents;
drop function if exists public.hf_guard_incident_refs();
revoke update (name, timezone) on public.organizations from authenticated;
grant update on public.organizations to authenticated;
alter table public.memberships drop column if exists display_name;
delete from supabase_migrations.schema_migrations
  where name = '20261114000500_hf_sec_fixes_member_names';
commit;
