-- Hey Foxy — 0005 correcciones HF-SEC-03 / HF-SEC-04 y nombre visible de miembros
-- Aditiva: no modifica ni borra objetos de 0001–0004. Rollback en
-- supabase/rollback/20261114000500_hf_sec_fixes_member_names.down.sql

-- 1. HF-SEC-03 ------------------------------------------------------------------
-- Un incidente solo puede enlazar una alerta de su misma organización (alta y
-- cambio de alert_id, también para el servidor). En el alta, el responsable debe
-- ser un miembro con rol de respuesta (en el UPDATE ya lo valida hf_incident_guard).
create function public.hf_guard_incident_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.alert_id is not null and not exists (
    select 1 from public.alerts a
    where a.id = new.alert_id and a.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.owner_user_id is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id = new.organization_id and m.user_id = new.owner_user_id
      and m.role in ('owner','admin','analyst','responder')) then
    raise exception 'incident owner must be a responder-capable member of the organization' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.hf_guard_incident_refs() from public, anon, authenticated;

create trigger incidents_refs_guard before insert or update of alert_id on public.incidents
  for each row execute function public.hf_guard_incident_refs();

-- 2. HF-SEC-04 ------------------------------------------------------------------
-- Owner/admin solo editan datos de presentación de su organización. plan, is_demo,
-- slug y retention_days quedan reservados a la plataforma (service_role).
revoke update on public.organizations from authenticated;
grant update (name, timezone) on public.organizations to authenticated;

-- 3. Nombre visible de miembros ----------------------------------------------------
-- auth.users no es legible por los usuarios; la UI necesita un nombre para asignar
-- incidentes. Lo gestionan owner/admin con los grants y políticas existentes de memberships.
alter table public.memberships
  add column display_name text
  check (display_name is null or length(trim(display_name)) between 1 and 120);
