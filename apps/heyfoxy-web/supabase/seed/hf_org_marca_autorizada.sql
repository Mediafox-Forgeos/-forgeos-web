-- Hey Foxy — organización independiente para la PRIMERA marca real autorizada (GO 1, punto 6).
--
-- Solo para heyfoxy-qa y DESPUÉS de la migración 0006. No importa datos: crea una organización
-- vacía, NO demo, con su fuente Metricool «no conectada» y pausada, y un único miembro owner
-- (qa-owner, controlado por Álvaro). Los datos reales nunca se mezclan con Clínica Aurora ni
-- Banco Horizonte: esas organizaciones son demo y 0006 rechaza en la base cualquier dato real en
-- ellas; además, una marca (blogId) solo puede vincularse a UNA organización.
--
-- La marca concreta se autoriza fuera de la base, en el servidor:
--   HF_METRICOOL_ALLOWED_BRANDS = 9c000000-0000-4000-a000-0000000000c1:<blogId autorizado>
-- Nunca MedPlus sin su autorización escrita.
--
-- Idempotente. Rollback (mientras no haya datos importados):
--   delete from public.organizations where id = '9c000000-0000-4000-a000-0000000000c1';
--   (en cascada: membresía y fuente; audit_logs conserva el registro, append-only)
do $chk$
begin
  if to_regprocedure('public.hf_guard_real_data_org()') is null then
    raise exception 'Requiere la migración 0006 aplicada (guarda de datos reales)';
  end if;
  if not exists (select 1 from auth.users where email = 'qa-owner@heyfoxy.test') then
    raise exception 'No existe qa-owner@heyfoxy.test';
  end if;
end
$chk$;

insert into public.organizations (id, name, slug, plan, is_demo, retention_days) values
  ('9c000000-0000-4000-a000-0000000000c1', 'MediaFOX · Marca autorizada (QA)', 'mediafox-marca-autorizada', 'pilot', false, 90)
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role, display_name)
select '9c000000-0000-4000-a000-0000000000c1', u.id, 'owner', 'Laura Ríos (QA owner)'
from auth.users u where u.email = 'qa-owner@heyfoxy.test'
on conflict (organization_id, user_id) do nothing;

insert into public.data_sources (id, organization_id, provider, display_name, status, status_reason, ingestion_paused) values
  ('9c000000-0000-4000-c000-000000000001', '9c000000-0000-4000-a000-0000000000c1', 'metricool',
   'Metricool (marca autorizada)', 'not_connected', 'Pendiente de GO 3 y de la marca autorizada en el servidor', true)
on conflict (id) do nothing;

insert into public.audit_logs (organization_id, action, entity_type, entity_id, metadata)
select '9c000000-0000-4000-a000-0000000000c1', 'hf_org_marca_autorizada_creada', 'organization',
       '9c000000-0000-4000-a000-0000000000c1', jsonb_build_object('go', 'GO 1 punto 6', 'is_demo', false)
where not exists (select 1 from public.audit_logs where action = 'hf_org_marca_autorizada_creada');

-- Verificación (falla si algo no quedó como se espera).
do $v$
declare o record;
begin
  select is_demo, (select count(*) from public.memberships m where m.organization_id = x.id) as members,
         (select count(*) from public.data_sources d where d.organization_id = x.id) as sources,
         (select count(*) from public.social_posts p where p.organization_id = x.id) as posts
    into o from public.organizations x where x.id = '9c000000-0000-4000-a000-0000000000c1';
  if o.is_demo or o.members <> 1 or o.sources <> 1 or o.posts <> 0 then
    raise exception 'Organización marca autorizada inconsistente: %', row_to_json(o);
  end if;
end
$v$;
