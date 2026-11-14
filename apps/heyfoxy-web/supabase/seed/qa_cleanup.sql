-- Hey Foxy — LIMPIEZA del seed sintético y de los usuarios QA. Solo heyfoxy-qa, solo con GO.
--
-- Borra ÚNICAMENTE las 2 organizaciones sintéticas del seed (ids fijos, is_demo = true) y los
-- usuarios *@heyfoxy.test. Las tablas append-only (incident_events, audit_logs) bloquean el
-- borrado por diseño; aquí se desactivan sus guardas SOLO durante esta transacción.
-- Para conservar los usuarios y limpiar solo datos, omitir el bloque 3.
begin;

-- Guarda: nunca toca organizaciones que no sean las sintéticas del seed.
do $g$
begin
  if exists (select 1 from public.organizations
             where id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1')
               and not is_demo) then
    raise exception 'Abortado: una organización del seed no está marcada is_demo';
  end if;
end
$g$;

-- 1. Desactivar guardas append-only (solo en esta transacción).
alter table public.incident_events disable trigger incident_events_append_only;
alter table public.audit_logs disable trigger audit_logs_append_only;

-- 2. Datos sintéticos (el resto cae por ON DELETE CASCADE).
delete from public.audit_logs
 where organization_id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1');
delete from public.organizations
 where id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1') and is_demo;

alter table public.incident_events enable trigger incident_events_append_only;
alter table public.audit_logs enable trigger audit_logs_append_only;

-- 3. Usuarios QA (identidades y sesiones caen por cascada).
delete from auth.users where email like '%@heyfoxy.test';

commit;
