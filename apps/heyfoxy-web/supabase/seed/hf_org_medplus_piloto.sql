-- Hey Foxy — piloto MedPlus: renombra la organización de la marca autorizada (doc 20).
--
-- Solo heyfoxy-qa, después de 0006 y de hf_org_marca_autorizada.sql. Conserva el UUID
-- 9c000000-0000-4000-a000-0000000000c1 (compatible con HF_METRICOOL_ALLOWED_BRANDS).
-- No importa datos, no conecta la fuente y no cambia miembros: la fuente sigue «no conectada» y
-- pausada hasta la primera sincronización manual autorizada (GO 4).
-- Registra en audit_logs el alcance de la autorización de MedPlus y las condiciones de
-- tratamiento y retención ANTES de cualquier importación.
--
-- Idempotente. Rollback (mientras no haya datos importados):
--   update public.organizations set name = 'MediaFOX · Marca autorizada (QA)', slug = 'mediafox-marca-autorizada'
--    where id = '9c000000-0000-4000-a000-0000000000c1';
--   update public.data_sources set display_name = 'Metricool (marca autorizada)',
--    status_reason = 'Pendiente de GO 3 y de la marca autorizada en el servidor'
--    where id = '9c000000-0000-4000-c000-000000000001';
--   (audit_logs es append-only: el registro de autorización se conserva)
do $chk$
declare o record;
begin
  select is_demo, (select count(*) from public.social_posts p where p.organization_id = x.id) as posts,
         (select count(*) from public.social_comments c where c.organization_id = x.id) as comments
    into o from public.organizations x where x.id = '9c000000-0000-4000-a000-0000000000c1';
  if not found then
    raise exception 'No existe la organización 9c000000-…c1 (ejecutar antes hf_org_marca_autorizada.sql)';
  end if;
  if o.is_demo then
    raise exception 'La organización del piloto no puede ser demo';
  end if;
  if o.posts > 0 or o.comments > 0 then
    raise exception 'La organización ya tiene datos importados: se detiene (%)', row_to_json(o);
  end if;
end
$chk$;

update public.organizations
   set name = 'MedPlus · Piloto QA', slug = 'medplus-piloto-qa'
 where id = '9c000000-0000-4000-a000-0000000000c1'
   and (name, slug) is distinct from ('MedPlus · Piloto QA', 'medplus-piloto-qa');

update public.data_sources
   set display_name = 'Metricool · MedPlus',
       status_reason = 'Pendiente de GO 4: primera sincronización manual autorizada'
 where id = '9c000000-0000-4000-c000-000000000001'
   and organization_id = '9c000000-0000-4000-a000-0000000000c1'
   and display_name is distinct from 'Metricool · MedPlus';

insert into public.audit_logs (organization_id, action, entity_type, entity_id, metadata)
select '9c000000-0000-4000-a000-0000000000c1', 'hf_medplus_autorizacion_registrada', 'organization',
       '9c000000-0000-4000-a000-0000000000c1',
       jsonb_build_object(
         'documento', 'docs/product/heyfoxy/20_MEDPLUS_PILOT_AUTHORIZATION.md',
         'autorizacion', 'Confirmada por el product owner (Álvaro) el 2026-11-26: MedPlus autoriza el piloto de Hey Foxy con sus datos de redes sociales',
         'entorno', 'heyfoxy-qa, Preview protegido; nunca Production',
         'fuente', 'Metricool, solo lectura (lista blanca de endpoints GET)',
         'redes', jsonb_build_array('instagram', 'facebook'),
         'datos', jsonb_build_array('publicaciones propias', 'fotografias y miniaturas por referencia', 'comentarios y respuestas publicos', 'metricas', 'enlaces originales'),
         'excluido', jsonb_build_array('mensajes privados', 'historias clinicas', 'copia de medios a Storage', 'videos completos', 'publicar o responder', 'WhatsApp', 'sincronizacion automatica'),
         'primera_importacion', jsonb_build_object('dias', 30, 'max_publicaciones_por_red', 10, 'disparo', 'manual'),
         'datos_personales', 'comentarios de terceros: correo, telefono, documento, tarjeta e historia clinica enmascarados antes de guardar; sin nombre visible ni imagen del autor; autor seudonimizado con HMAC por organizacion',
         'retencion_dias', 90,
         'acceso', 'solo miembros de la organizacion (RLS); unico miembro qa-owner'
       )
where not exists (select 1 from public.audit_logs where action = 'hf_medplus_autorizacion_registrada');

-- Verificación (falla si algo no quedó como se espera).
do $v$
declare o record;
begin
  select x.name, x.slug, x.is_demo, x.retention_days,
         (select count(*) from public.memberships m where m.organization_id = x.id) as members,
         (select d.status from public.data_sources d where d.id = '9c000000-0000-4000-c000-000000000001') as src_status,
         (select d.ingestion_paused from public.data_sources d where d.id = '9c000000-0000-4000-c000-000000000001') as src_paused,
         (select count(*) from public.audit_logs a where a.action = 'hf_medplus_autorizacion_registrada') as audit
    into o from public.organizations x where x.id = '9c000000-0000-4000-a000-0000000000c1';
  if o.name <> 'MedPlus · Piloto QA' or o.is_demo or o.members <> 1 or o.src_status <> 'not_connected'
     or not o.src_paused or o.audit <> 1 or o.retention_days <> 90 then
    raise exception 'Piloto MedPlus inconsistente: %', row_to_json(o);
  end if;
end
$v$;
