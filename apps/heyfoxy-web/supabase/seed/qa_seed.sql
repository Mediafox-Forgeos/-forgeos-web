-- Hey Foxy — seed SINTÉTICO para Supabase QA (WO-MFOX-HEYFOXY-001 Gate 2).
-- Ejecutar SOLO en el proyecto heyfoxy-qa, después de las 3 migraciones y de crear los usuarios de prueba
-- en Auth (correos *@heyfoxy.test; las contraseñas NO viven en el repositorio).
-- Sin datos reales de MedPlus ni de ninguna persona. Idempotente: se puede re-ejecutar.

do $seed$
declare
  v_missing text;
begin
  -- Guarda: este seed solo corre donde existen los usuarios QA.
  select string_agg(e, ', ') into v_missing
  from unnest(array['qa-owner@heyfoxy.test','qa-admin@heyfoxy.test','qa-analyst@heyfoxy.test',
                    'qa-responder@heyfoxy.test','qa-viewer@heyfoxy.test','qa-owner-b@heyfoxy.test']) e
  where not exists (select 1 from auth.users u where u.email = e);
  if v_missing is not null then
    raise exception 'Faltan usuarios QA en Auth: %', v_missing;
  end if;
end
$seed$;

insert into public.organizations (id, name, slug, plan, is_demo) values
  ('9a000000-0000-4000-a000-0000000000a1', 'QA Clínica Sintética', 'qa-clinica-sintetica', 'pilot', true),
  ('9b000000-0000-4000-a000-0000000000b1', 'QA Banco Sintético',   'qa-banco-sintetico',   'pilot', true)
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role)
select m.org::uuid, u.id, m.role::public.hf_role
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-owner@heyfoxy.test',     'owner'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-admin@heyfoxy.test',     'admin'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-analyst@heyfoxy.test',   'analyst'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-responder@heyfoxy.test', 'responder'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-viewer@heyfoxy.test',    'viewer'),
  ('9b000000-0000-4000-a000-0000000000b1', 'qa-owner-b@heyfoxy.test',   'owner')
) as m(org, email, role)
join auth.users u on u.email = m.email
on conflict (organization_id, user_id) do nothing;

insert into public.brands (id, organization_id, name, keywords) values
  ('9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'Clínica Sintética', array['clinica sintetica','qa clinica']),
  ('9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'Banco Sintético',   array['banco sintetico'])
on conflict (id) do nothing;

-- Fuentes: demo (sintética) + Metricool registrada pero NO conectada y pausada.
insert into public.data_sources (id, organization_id, provider, display_name, status, status_reason, ingestion_paused) values
  ('9a000000-0000-4000-c000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'demo',      'Datos sintéticos QA', 'connected',     'Fuente sintética de QA', true),
  ('9a000000-0000-4000-c000-000000000002', '9a000000-0000-4000-a000-0000000000a1', 'metricool', 'Metricool (no conectado)', 'not_connected', 'Pendiente de autorización (Gate 2)', true),
  ('9b000000-0000-4000-c000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'demo',      'Datos sintéticos QA', 'connected',     'Fuente sintética de QA', true)
on conflict (id) do nothing;

insert into public.source_coverage (organization_id, data_source_id, platform, data_kind, status, reason, period_start)
select v.organization_id::uuid, v.data_source_id::uuid, v.platform::public.hf_platform,
       v.data_kind::public.hf_data_kind, v.status::public.hf_coverage_status, v.reason, v.period_start from (values
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000001', 'facebook',  'comments', 'partial',       'Sintético: solo publicaciones propias', now() - interval '7 days'),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000001', 'instagram', 'comments', 'partial',       'Sintético: solo publicaciones propias', now() - interval '7 days'),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000002', 'facebook',  'mentions', 'unavailable',   'Metricool no ofrece menciones de terceros', now() - interval '7 days'),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000002', 'x',         'comments', 'not_permitted', 'Sin autorización', now() - interval '7 days')
) as v(organization_id, data_source_id, platform, data_kind, status, reason, period_start)
where not exists (select 1 from public.source_coverage c
                  where c.data_source_id = v.data_source_id::uuid and c.platform = v.platform::public.hf_platform
                    and c.data_kind = v.data_kind::public.hf_data_kind);

insert into public.social_comments (organization_id, brand_id, data_source_id, platform, external_id, body, author_hash, author_display,
                                    published_at, content_hash, is_synthetic) values
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'facebook',  'qa-c-001',
   '[SINTÉTICO] Llevo tres semanas esperando la autorización y nadie responde.', 'qa-author-1', 'Usuario sintético 1', now() - interval '2 hours', 'qa-hash-001', true),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'instagram', 'qa-c-002',
   '[SINTÉTICO] Excelente atención en urgencias, gracias al equipo.', 'qa-author-2', 'Usuario sintético 2', now() - interval '5 hours', 'qa-hash-002', true),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'facebook',  'qa-c-003',
   '[SINTÉTICO] ¿Cuál es el horario de la sede norte?', 'qa-author-3', 'Usuario sintético 3', now() - interval '1 day', 'qa-hash-003', true),
  ('9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-c000-000000000001', 'x',         'qa-c-101',
   '[SINTÉTICO] La app del banco no carga desde ayer.', 'qa-author-9', 'Usuario sintético 9', now() - interval '3 hours', 'qa-hash-101', true)
on conflict (organization_id, data_source_id, external_id) do nothing;

insert into public.alerts (organization_id, title, summary, severity, priority_score, review_status, dedupe_key, is_synthetic) values
  ('9a000000-0000-4000-a000-0000000000a1', '[SINTÉTICO] Reclamos por demoras en autorizaciones',
   'Alerta sintética de QA para validar revisión humana.', 'critical', 88, 'pending', 'qa-alert-001', true),
  ('9a000000-0000-4000-a000-0000000000a1', '[SINTÉTICO] Consultas de horario',
   'Alerta sintética operativa.', 'info', 20, 'not_required', 'qa-alert-002', true),
  ('9b000000-0000-4000-a000-0000000000b1', '[SINTÉTICO] Falla de app reportada',
   'Alerta sintética del banco (no debe verse desde la clínica).', 'high', 70, 'not_required', 'qa-alert-101', true)
on conflict (organization_id, dedupe_key) do nothing;

-- Destinatario WhatsApp con número reservado de ficción; WhatsApp sigue en modo simulate.
insert into public.whatsapp_recipients (organization_id, display_name, phone_e164)
select '9a000000-0000-4000-a000-0000000000a1', 'Destinatario sintético QA', '+570000000001'
where not exists (select 1 from public.whatsapp_recipients
                  where organization_id = '9a000000-0000-4000-a000-0000000000a1' and phone_e164 = '+570000000001');
