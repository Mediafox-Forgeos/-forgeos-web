-- Hey Foxy — seed SINTÉTICO para Supabase QA (WO-MFOX-HEYFOXY-001, Gate 2).
--
-- Requisitos: migraciones 0001–0005 aplicadas y los 6 usuarios QA creados en Auth
-- (correos *@heyfoxy.test; las contraseñas NO viven en el repositorio).
-- Ejecutar SOLO en heyfoxy-qa y solo con GO. Idempotente: re-ejecutarlo no duplica nada
-- (ids fijos + ON CONFLICT / NOT EXISTS). Limpieza: supabase/seed/qa_cleanup.sql.
--
-- Todo es FICTICIO: organizaciones marcadas is_demo = true, filas con is_synthetic = true
-- y textos con el prefijo [SINTÉTICO]. No hay datos de MedPlus, de Banco de Occidente ni de
-- ninguna persona real. Teléfonos en el rango ficticio +5700000000xx.
begin;

-- 0. Guarda: solo corre donde existen los 6 usuarios QA -------------------------------
do $seed$
declare v_missing text;
begin
  select string_agg(e, ', ') into v_missing
  from unnest(array['qa-owner@heyfoxy.test','qa-admin@heyfoxy.test','qa-analyst@heyfoxy.test',
                    'qa-responder@heyfoxy.test','qa-viewer@heyfoxy.test','qa-owner-b@heyfoxy.test']) e
  where not exists (select 1 from auth.users u where u.email = e);
  if v_missing is not null then
    raise exception 'Faltan usuarios QA en Auth: %', v_missing;
  end if;
end
$seed$;

-- 1. Organizaciones, miembros y marcas ---------------------------------------------------
insert into public.organizations (id, name, slug, plan, is_demo, retention_days) values
  ('9a000000-0000-4000-a000-0000000000a1', 'Clínica Aurora (QA sintética)', 'qa-clinica-aurora', 'pilot', true, 90),
  ('9b000000-0000-4000-a000-0000000000b1', 'Banco Horizonte (QA sintético)', 'qa-banco-horizonte', 'pilot', true, 90)
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role, display_name)
select m.org::uuid, u.id, m.role::public.hf_role, m.display_name
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-owner@heyfoxy.test',     'owner',     'Laura Ríos (QA owner)'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-admin@heyfoxy.test',     'admin',     'Diego Mora (QA admin)'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-analyst@heyfoxy.test',   'analyst',   'Andrea Gil (QA analyst)'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-responder@heyfoxy.test', 'responder', 'Camilo Paz (QA responder)'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-viewer@heyfoxy.test',    'viewer',    'Mateo Silva (QA viewer)'),
  ('9b000000-0000-4000-a000-0000000000b1', 'qa-owner-b@heyfoxy.test',   'owner',     'Sofía Lara (QA owner banco)')
) as m(org, email, role, display_name)
join auth.users u on u.email = m.email
on conflict (organization_id, user_id) do update
  set role = excluded.role, display_name = excluded.display_name;

insert into public.brands (id, organization_id, name, keywords) values
  ('9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'Clínica Aurora', array['clinica aurora','aurora salud']),
  ('9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'Banco Horizonte', array['banco horizonte','app horizonte'])
on conflict (id) do nothing;

-- 2. Fuentes, cuentas y cobertura -------------------------------------------------------
-- Fuente demo (sintética, ingesta pausada) + Metricool registrada pero NO conectada.
insert into public.data_sources (id, organization_id, provider, display_name, status, status_reason, ingestion_paused) values
  ('9a000000-0000-4000-c000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'demo',      'Datos sintéticos QA',      'connected',     'Fuente sintética de QA', true),
  ('9a000000-0000-4000-c000-000000000002', '9a000000-0000-4000-a000-0000000000a1', 'metricool', 'Metricool (no conectado)', 'not_connected', 'Pendiente de autorización del cliente', true),
  ('9b000000-0000-4000-c000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'demo',      'Datos sintéticos QA',      'connected',     'Fuente sintética de QA', true)
on conflict (id) do nothing;

insert into public.social_accounts (id, organization_id, brand_id, data_source_id, platform, external_id, handle, ownership, status) values
  ('9a000000-0000-4000-d000-000000000001', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'instagram', 'qa-acc-a-ig', '@clinicaaurora.qa', 'owned', 'connected'),
  ('9a000000-0000-4000-d000-000000000002', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'facebook',  'qa-acc-a-fb', 'Clínica Aurora QA', 'owned', 'connected'),
  ('9a000000-0000-4000-d000-000000000003', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-b000-000000000001', '9a000000-0000-4000-c000-000000000001', 'x',         'qa-acc-a-x',  '@aurora_qa',        'owned', 'connected'),
  ('9b000000-0000-4000-d000-000000000001', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-c000-000000000001', 'x',         'qa-acc-b-x',  '@horizonte_qa',     'owned', 'connected'),
  ('9b000000-0000-4000-d000-000000000002', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-c000-000000000001', 'facebook',  'qa-acc-b-fb', 'Banco Horizonte QA', 'owned', 'connected'),
  ('9b000000-0000-4000-d000-000000000003', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-b000-000000000001', '9b000000-0000-4000-c000-000000000001', 'instagram', 'qa-acc-b-ig', '@bancohorizonte.qa', 'owned', 'connected')
on conflict (id) do nothing;

insert into public.source_coverage (organization_id, data_source_id, social_account_id, platform, data_kind, status, reason, period_start, items_ingested, last_success_at)
select v.org::uuid, v.ds::uuid, v.acc::uuid, v.platform::public.hf_platform, v.kind::public.hf_data_kind,
       v.status::public.hf_coverage_status, v.reason, now() - interval '7 days', v.items, case when v.items > 0 then now() - interval '1 hour' end
from (values
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000001', '9a000000-0000-4000-d000-000000000001', 'instagram', 'comments', 'complete',      '[SINTÉTICO] Comentarios de publicaciones propias', 7),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000001', '9a000000-0000-4000-d000-000000000002', 'facebook',  'comments', 'complete',      '[SINTÉTICO] Comentarios de publicaciones propias', 5),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000001', '9a000000-0000-4000-d000-000000000003', 'x',         'mentions', 'partial',       '[SINTÉTICO] Solo menciones directas a la cuenta', 3),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000002', null,                                   'facebook',  'mentions', 'unavailable',   'Metricool no ofrece menciones de terceros', 0),
  ('9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-c000-000000000002', null,                                   'tiktok',    'comments', 'not_permitted', 'Sin autorización del cliente', 0),
  ('9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-c000-000000000001', '9b000000-0000-4000-d000-000000000001', 'x',         'comments', 'partial',       '[SINTÉTICO] Datos públicos limitados', 3),
  ('9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-c000-000000000001', '9b000000-0000-4000-d000-000000000002', 'facebook',  'comments', 'complete',      '[SINTÉTICO] Comentarios de publicaciones propias', 3),
  ('9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-c000-000000000001', '9b000000-0000-4000-d000-000000000003', 'instagram', 'comments', 'partial',       '[SINTÉTICO] Business Discovery: sin texto de comentarios', 2)
) as v(org, ds, acc, platform, kind, status, reason, items)
where not exists (select 1 from public.source_coverage c
                  where c.data_source_id = v.ds::uuid and c.platform = v.platform::public.hf_platform
                    and c.data_kind = v.kind::public.hf_data_kind);

-- 3. Publicaciones y métricas -------------------------------------------------------------
insert into public.social_posts (id, organization_id, social_account_id, data_source_id, platform, external_id, body, published_at, is_synthetic) values
  ('9a000000-0000-4000-e000-000000000001', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-d000-000000000001', '9a000000-0000-4000-c000-000000000001', 'instagram', 'qa-post-a-1', '[SINTÉTICO] Conoce la nueva app de citas de Clínica Aurora', now() - interval '2 days', true),
  ('9a000000-0000-4000-e000-000000000002', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-d000-000000000002', '9a000000-0000-4000-c000-000000000001', 'facebook',  'qa-post-a-2', '[SINTÉTICO] Jornada de vacunación este sábado', now() - interval '3 days', true),
  ('9a000000-0000-4000-e000-000000000003', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-d000-000000000003', '9a000000-0000-4000-c000-000000000001', 'x',         'qa-post-a-3', '[SINTÉTICO] Horarios de urgencias para el puente festivo', now() - interval '1 day', true),
  ('9b000000-0000-4000-e000-000000000001', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-d000-000000000001', '9b000000-0000-4000-c000-000000000001', 'x',         'qa-post-b-1', '[SINTÉTICO] Mantenimiento programado de la app esta noche', now() - interval '1 day', true),
  ('9b000000-0000-4000-e000-000000000002', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-d000-000000000002', '9b000000-0000-4000-c000-000000000001', 'facebook',  'qa-post-b-2', '[SINTÉTICO] Nuevo crédito de vivienda Horizonte', now() - interval '4 days', true)
on conflict (organization_id, data_source_id, external_id) do nothing;

insert into public.post_metric_snapshots (organization_id, post_id, captured_at, likes, comments, shares, views, reach, is_synthetic)
select p.organization_id, p.id, now() - (s.hours_ago || ' hours')::interval, s.likes, s.comments, s.shares, s.views, s.reach, true
from public.social_posts p
join (values
  ('qa-post-a-1', 24, 120, 18, 4, 2400, 1900), ('qa-post-a-1', 1, 310, 64, 9, 6100, 4800),
  ('qa-post-a-2', 48, 210, 12, 30, 3900, 3100), ('qa-post-a-3', 2, 45, 22, 3, 1500, 1200),
  ('qa-post-b-1', 3, 80, 41, 5, 2800, 2100), ('qa-post-b-2', 72, 150, 9, 12, 3300, 2600)
) as s(ext, hours_ago, likes, comments, shares, views, reach) on s.ext = p.external_id
where p.organization_id in ('9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1')
  and not exists (select 1 from public.post_metric_snapshots m
                  where m.post_id = p.id and m.likes = s.likes and m.is_synthetic);

-- 4. Comentarios + clasificación (una fila de análisis por comentario) -------------------
create temp table qa_items (
  org uuid, ext text, platform public.hf_platform, post_ext text, hours int, author text, body text,
  sentiment public.hf_sentiment, intent text, topics text[], severity public.hf_severity,
  confidence numeric, priority numeric, layer text, review public.hf_review_status, explanation text
) on commit drop;

insert into qa_items values
  -- Clínica Aurora
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-01','instagram','qa-post-a-1',1,'paciente_ficticio_01','Llevo 3 horas de espera en urgencias con mi mamá, nadie nos informa nada','negative','complaint','{Tiempos de espera}','high',0.91,78,'operational','not_required','Queja por espera prolongada en urgencias sin información al paciente.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-02','instagram','qa-post-a-1',2,'usuario_demo_02','¿Cómo puedo agendar una cita con dermatología por la app? No me deja seleccionar fecha','neutral','question','{App y canales digitales}','attention',0.84,45,'operational','not_required','Pregunta operativa sobre el agendamiento en la app.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-03','facebook','qa-post-a-2',2,'usuario_demo_03','Excelente atención de las enfermeras del piso 4, muy amables. Gracias!','positive','praise','{Atención y servicio}','info',0.95,12,'operational','not_required','Elogio al personal de enfermería.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-04','x','qa-post-a-3',3,'usuario_demo_04','Voy a poner una tutela, me negaron el procedimiento y ya pasaron dos meses. Supersalud tiene que saber esto','negative','crisis_signal','{Autorizaciones y procedimientos}','critical',0.89,92,'reputational','confirmed','Amenaza de acción legal y escalamiento al regulador: riesgo reputacional alto.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-05','instagram','qa-post-a-1',4,'usuario_demo_05','La app no sirve, no me deja entrar con mi contraseña desde ayer','negative','complaint','{App y canales digitales}','high',0.88,74,'operational','not_required','Falla de acceso a la app; forma parte de un pico de reclamos.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-06','instagram','qa-post-a-1',5,'usuario_demo_06','La app no sirve, imposible ver los resultados de laboratorio','negative','complaint','{App y canales digitales}','high',0.87,73,'operational','not_required','Falla funcional de la app (resultados de laboratorio).'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-07','instagram','qa-post-a-1',5,'usuario_demo_07','La aplicación está caída otra vez? no carga la agenda','negative','complaint','{App y canales digitales}','high',0.86,72,'operational','not_required','Reporte de caída de la app; tercer reclamo similar en 5 horas.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-08','x','qa-post-a-3',6,'periodista_ficticio','Varios usuarios reportan una posible infección tras procedimientos en una sede de Clínica Aurora. Estamos verificando la noticia','negative','crisis_signal','{Seguridad del paciente}','critical',0.82,95,'reputational','pending','Posible noticia sobre seguridad del paciente difundida por un medio: requiere revisión humana inmediata.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-09','facebook','qa-post-a-2',7,'usuario_demo_09','Me cobraron dos veces la cuota moderadora, quiero que me devuelvan el dinero','negative','complaint','{Facturación}','attention',0.9,58,'operational','not_required','Reclamo de cobro duplicado.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-10','facebook','qa-post-a-2',9,'usuario_demo_10','Recomiendo mucho al equipo de pediatría, genial','positive','praise','{Atención y servicio}','info',0.94,10,'operational','not_required','Recomendación positiva del servicio de pediatría.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-11','facebook','qa-post-a-2',13,'usuario_demo_12','Gana dinero desde casa haz clic aquí bit.ly/xxxxx','neutral','spam','{}','info',0.97,2,'operational','not_required','Spam con enlace acortado; no requiere respuesta.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-12','x','qa-post-a-3',15,'usuario_demo_13','Demora terrible para las citas de especialista, 40 días para ortopedia','negative','complaint','{Tiempos de espera}','attention',0.88,61,'reputational','not_required','Tendencia de quejas por demora en citas de especialista.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-13','x','qa-post-a-3',40,'usuario_demo_17','Mi papá falleció y aún no nos entregan la historia clínica, es una negligencia','negative','complaint','{Autorizaciones y procedimientos}','high',0.8,84,'reputational','pending','Caso sensible con acusación de negligencia: revisión humana recomendada.'),
  ('9a000000-0000-4000-a000-0000000000a1','qa-c-a-14','facebook','qa-post-a-2',70,'usuario_demo_19','Atención excelente en laboratorio, rápido y amables','positive','praise','{Atención y servicio}','info',0.93,8,'operational','not_required','Elogio al laboratorio.'),
  -- Banco Horizonte
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-01','x','qa-post-b-1',1,'cliente_ficticio_01','Me hicieron un cobro que no reconozco en la tarjeta, posible fraude. Nadie contesta la línea','negative','crisis_signal','{Fraude y cobros}','critical',0.9,93,'reputational','pending','Posible fraude y falla del canal telefónico: riesgo reputacional alto.'),
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-02','facebook','qa-post-b-2',2,'cliente_demo_02','¿Cómo hago para cambiar la clave de la app?','neutral','question','{App y canales digitales}','info',0.9,20,'operational','not_required','Pregunta operativa sobre la app.'),
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-03','x','qa-post-b-1',4,'cliente_demo_04','La app del banco no sirve hoy, no puedo hacer transferencias','negative','complaint','{App y canales digitales}','high',0.88,76,'operational','not_required','Falla de transferencias en la app.'),
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-04','x','qa-post-b-1',4,'cliente_demo_05','La aplicación está caída, horrible justo en quincena','negative','complaint','{App y canales digitales}','high',0.87,75,'operational','not_required','Caída de la app en día de alto uso.'),
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-05','facebook','qa-post-b-2',8,'cliente_demo_06','Excelente asesoría en la oficina, muy amables, gracias','positive','praise','{Atención}','info',0.94,9,'operational','not_required','Elogio a la atención en oficina.'),
  ('9b000000-0000-4000-a000-0000000000b1','qa-c-b-06','facebook','qa-post-b-2',30,'cliente_demo_08','Recomiendo el crédito de vivienda, proceso rápido','positive','praise','{Productos}','info',0.92,11,'operational','not_required','Recomendación de producto.');

insert into public.social_comments (organization_id, brand_id, data_source_id, post_id, platform, external_id, body,
                                    author_hash, author_display, published_at, content_hash, is_synthetic)
select i.org, b.id, d.id, p.id, i.platform, i.ext, '[SINTÉTICO] ' || i.body,
       'qa-' || md5(i.author), i.author, now() - (i.hours || ' hours')::interval, md5(lower(i.body)), true
from qa_items i
join public.brands b on b.organization_id = i.org
join public.data_sources d on d.organization_id = i.org and d.provider = 'demo'
left join public.social_posts p on p.organization_id = i.org and p.external_id = i.post_ext
on conflict (organization_id, data_source_id, external_id) do nothing;

insert into public.sentiment_analyses (organization_id, item_type, item_id, layer, sentiment, intent, topics, severity,
                                       confidence, explanation, priority_score, provider, model, prompt_version, input_hash,
                                       review_status, reviewed_by, reviewed_at)
select i.org, 'comment', c.id, i.layer, i.sentiment, i.intent, i.topics, i.severity, i.confidence,
       '[SINTÉTICO] ' || i.explanation, i.priority, 'heuristic', 'qa-seed', 'qa-seed-v1', 'qa-' || i.ext,
       i.review,
       case when i.review = 'confirmed' then (select id from auth.users where email = 'qa-analyst@heyfoxy.test') end,
       case when i.review = 'confirmed' then now() - interval '2 hours' end
from qa_items i
join public.social_comments c on c.organization_id = i.org and c.external_id = i.ext
on conflict (organization_id, item_type, item_id, prompt_version, model) do nothing;

-- 5. Menciones (fuera de publicaciones propias) ----------------------------------------------
insert into public.social_mentions (organization_id, brand_id, data_source_id, platform, external_id, body, author_hash,
                                    author_display, published_at, content_hash, is_synthetic)
select v.org::uuid, b.id, d.id, v.platform::public.hf_platform, v.ext, '[SINTÉTICO] ' || v.body, 'qa-' || md5(v.author), v.author,
       now() - (v.hours || ' hours')::interval, md5(lower(v.body)), true
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-m-a-1', 'x',        3, 'medio_ficticio', '¿Alguien más ha tenido problemas con la app de Clínica Aurora hoy?'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-m-a-2', 'x',       20, 'usuario_demo_21', 'La sede centro de Clínica Aurora tiene el mejor servicio de la ciudad'),
  ('9a000000-0000-4000-a000-0000000000a1', 'qa-m-a-3', 'facebook', 30, 'grupo_ficticio', 'Recomienden especialistas en Clínica Aurora, la espera está larga'),
  ('9b000000-0000-4000-a000-0000000000b1', 'qa-m-b-1', 'x',        2, 'cliente_demo_09', 'Banco Horizonte caído en plena quincena'),
  ('9b000000-0000-4000-a000-0000000000b1', 'qa-m-b-2', 'x',       26, 'cliente_demo_10', 'Buen servicio de Banco Horizonte en la oficina norte')
) as v(org, ext, platform, hours, author, body)
join public.brands b on b.organization_id = v.org::uuid
join public.data_sources d on d.organization_id = v.org::uuid and d.provider = 'demo'
on conflict (organization_id, data_source_id, external_id) do nothing;

-- 6. Temas y grupos de conversación --------------------------------------------------------
insert into public.topics (organization_id, label, is_sensitive)
select v.org::uuid, v.label, v.sensitive from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'Tiempos de espera', false),
  ('9a000000-0000-4000-a000-0000000000a1', 'App y canales digitales', false),
  ('9a000000-0000-4000-a000-0000000000a1', 'Autorizaciones y procedimientos', true),
  ('9a000000-0000-4000-a000-0000000000a1', 'Facturación', false),
  ('9a000000-0000-4000-a000-0000000000a1', 'Atención y servicio', false),
  ('9a000000-0000-4000-a000-0000000000a1', 'Seguridad del paciente', true),
  ('9b000000-0000-4000-a000-0000000000b1', 'App y canales digitales', false),
  ('9b000000-0000-4000-a000-0000000000b1', 'Fraude y cobros', true),
  ('9b000000-0000-4000-a000-0000000000b1', 'Productos', false),
  ('9b000000-0000-4000-a000-0000000000b1', 'Atención', false)
) as v(org, label, sensitive)
on conflict (organization_id, label) do nothing;

insert into public.conversation_clusters (id, organization_id, topic_id, label, window_start, window_end, item_count, negative_share, baseline_ratio)
select v.id::uuid, v.org::uuid, t.id, v.label, now() - interval '6 hours', now(), v.n, v.neg, v.ratio
from (values
  ('9a000000-0000-4000-f000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'App y canales digitales', '[SINTÉTICO] Reclamos por falla de la app', 3, 1.0, 3.5),
  ('9b000000-0000-4000-f000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'App y canales digitales', '[SINTÉTICO] Caída de la app en quincena', 2, 1.0, 4.0)
) as v(id, org, topic, label, n, neg, ratio)
join public.topics t on t.organization_id = v.org::uuid and t.label = v.topic
on conflict (id) do nothing;

-- 7. Reglas y alertas ----------------------------------------------------------------------
insert into public.alert_rules (id, organization_id, name, min_severity, min_priority, topics, volume_spike_ratio, notify_whatsapp) values
  ('9a000000-0000-4000-9000-000000000001', '9a000000-0000-4000-a000-0000000000a1', 'Crisis reputacional', 'critical', 85, '{}', null, true),
  ('9a000000-0000-4000-9000-000000000002', '9a000000-0000-4000-a000-0000000000a1', 'Pico de reclamos', 'high', 70, '{}', 3, false),
  ('9b000000-0000-4000-9000-000000000001', '9b000000-0000-4000-a000-0000000000b1', 'Crisis reputacional', 'critical', 85, '{}', null, true)
on conflict (id) do nothing;

insert into public.alerts (id, organization_id, alert_rule_id, analysis_id, cluster_id, title, summary, severity, priority_score,
                           review_status, reviewed_by, reviewed_at, dedupe_key, is_synthetic)
select v.id::uuid, v.org::uuid, v.rule::uuid,
       (select s.id from public.sentiment_analyses s join public.social_comments c on c.id = s.item_id
        where c.organization_id = v.org::uuid and c.external_id = v.item_ext),
       v.cluster::uuid, '[SINTÉTICO] ' || v.title, v.summary, v.severity::public.hf_severity, v.priority,
       v.review::public.hf_review_status,
       case when v.review in ('confirmed', 'dismissed') then (select id from auth.users where email = 'qa-analyst@heyfoxy.test') end,
       case when v.review in ('confirmed', 'dismissed') then now() - interval '2 hours' end,
       v.dedupe, true
from (values
  ('9a000000-0000-4000-8000-000000000001', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-9000-000000000001', 'qa-c-a-08', null,
   'Posible noticia sobre infección en una sede', 'Un medio ficticio reporta una posible infección tras procedimientos. Pendiente de revisión humana antes de escalar.', 'critical', 95, 'pending', 'qa-alert-a-01'),
  ('9a000000-0000-4000-8000-000000000002', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-9000-000000000001', 'qa-c-a-04', null,
   'Amenaza de tutela y queja ante el regulador', 'Usuario anuncia acción legal por procedimiento negado. Revisado y confirmado por analyst.', 'critical', 92, 'confirmed', 'qa-alert-a-02'),
  ('9a000000-0000-4000-8000-000000000003', '9a000000-0000-4000-a000-0000000000a1', '9a000000-0000-4000-9000-000000000002', null, '9a000000-0000-4000-f000-000000000001',
   'Pico de reclamos por falla de la app', '3 reclamos en 5 horas (3,5× la línea base) sobre acceso y caída de la app.', 'high', 76, 'not_required', 'qa-alert-a-03'),
  ('9a000000-0000-4000-8000-000000000004', '9a000000-0000-4000-a000-0000000000a1', null, 'qa-c-a-12', null,
   'Demoras en citas de especialista', 'Tendencia de quejas por tiempos de espera de 40 días.', 'attention', 61, 'not_required', 'qa-alert-a-04'),
  ('9a000000-0000-4000-8000-000000000005', '9a000000-0000-4000-a000-0000000000a1', null, 'qa-c-a-13', null,
   'Acusación de negligencia (caso sensible)', 'Familiar reclama la historia clínica. Descartada como crisis tras revisión; se atiende por canal privado.', 'high', 84, 'dismissed', 'qa-alert-a-05'),
  ('9b000000-0000-4000-8000-000000000001', '9b000000-0000-4000-a000-0000000000b1', '9b000000-0000-4000-9000-000000000001', 'qa-c-b-01', null,
   'Posible fraude con tarjeta y línea sin respuesta', 'Cliente ficticio reporta un cobro no reconocido. Pendiente de revisión humana.', 'critical', 93, 'pending', 'qa-alert-b-01'),
  ('9b000000-0000-4000-8000-000000000002', '9b000000-0000-4000-a000-0000000000b1', null, null, '9b000000-0000-4000-f000-000000000001',
   'Caída de la app en quincena', '2 reclamos y 1 mención en 4 horas sobre transferencias.', 'high', 76, 'not_required', 'qa-alert-b-02')
) as v(id, org, rule, item_ext, cluster, title, summary, severity, priority, review, dedupe)
on conflict (id) do nothing;

-- 8. Incidentes con historial trazable -------------------------------------------------------
-- Las transiciones pasan por los triggers reales (FSM + eventos). El actor de cada evento es
-- el usuario QA que lo realiza (request.jwt.claim.sub, local a la transacción).
do $inc$
declare
  v_owner   uuid := (select id from auth.users where email = 'qa-owner@heyfoxy.test');
  v_analyst uuid := (select id from auth.users where email = 'qa-analyst@heyfoxy.test');
  v_resp    uuid := (select id from auth.users where email = 'qa-responder@heyfoxy.test');
  v_owner_b uuid := (select id from auth.users where email = 'qa-owner-b@heyfoxy.test');
  a uuid := '9a000000-0000-4000-a000-0000000000a1';
  b uuid := '9b000000-0000-4000-a000-0000000000b1';
begin
  -- I-A1: desde la alerta confirmada de tutela; en investigación, con nota.
  if not exists (select 1 from public.incidents where id = '9a000000-0000-4000-7000-000000000001') then
    insert into public.incidents (id, organization_id, alert_id, title, severity, opened_by, is_synthetic)
    values ('9a000000-0000-4000-7000-000000000001', a, '9a000000-0000-4000-8000-000000000002',
            '[SINTÉTICO] Amenaza de tutela y queja ante el regulador', 'critical', v_analyst, true);
    perform set_config('request.jwt.claim.sub', v_analyst::text, true);
    update public.incidents set owner_user_id = v_resp where id = '9a000000-0000-4000-7000-000000000001';
    perform set_config('request.jwt.claim.sub', v_resp::text, true);
    update public.incidents set status = 'acknowledged' where id = '9a000000-0000-4000-7000-000000000001';
    update public.incidents set status = 'investigating' where id = '9a000000-0000-4000-7000-000000000001';
    insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, body)
    values (a, '9a000000-0000-4000-7000-000000000001', v_resp, 'note',
            '[SINTÉTICO] Se contactó al usuario por mensaje privado; jurídica revisa el caso.');
  end if;

  -- I-A2: desde el pico de reclamos de la app; ciclo completo hasta el cierre con resumen.
  if not exists (select 1 from public.incidents where id = '9a000000-0000-4000-7000-000000000002') then
    insert into public.incidents (id, organization_id, alert_id, title, severity, opened_by, is_synthetic)
    values ('9a000000-0000-4000-7000-000000000002', a, '9a000000-0000-4000-8000-000000000003',
            '[SINTÉTICO] Pico de reclamos por falla de la app', 'high', v_owner, true);
    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    update public.incidents set owner_user_id = v_resp where id = '9a000000-0000-4000-7000-000000000002';
    perform set_config('request.jwt.claim.sub', v_resp::text, true);
    update public.incidents set status = 'acknowledged' where id = '9a000000-0000-4000-7000-000000000002';
    update public.incidents set status = 'investigating' where id = '9a000000-0000-4000-7000-000000000002';
    update public.incidents set status = 'responding' where id = '9a000000-0000-4000-7000-000000000002';
    insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, body)
    values (a, '9a000000-0000-4000-7000-000000000002', v_resp, 'note',
            '[SINTÉTICO] TI confirma falla del proveedor de autenticación; respuesta pública publicada.');
    update public.incidents set status = 'resolved' where id = '9a000000-0000-4000-7000-000000000002';
    update public.incidents set status = 'closed',
           resolution_summary = '[SINTÉTICO] Proveedor restableció el servicio; se respondió a los 3 usuarios y se publicó un aviso.'
     where id = '9a000000-0000-4000-7000-000000000002';
  end if;

  -- I-B1 (banco): abierto y asignado; no debe verse desde la clínica.
  if not exists (select 1 from public.incidents where id = '9b000000-0000-4000-7000-000000000001') then
    insert into public.incidents (id, organization_id, alert_id, title, severity, opened_by, is_synthetic)
    values ('9b000000-0000-4000-7000-000000000001', b, '9b000000-0000-4000-8000-000000000002',
            '[SINTÉTICO] Caída de la app en quincena', 'high', v_owner_b, true);
    perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
    update public.incidents set owner_user_id = v_owner_b where id = '9b000000-0000-4000-7000-000000000001';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
end
$inc$;

-- 9. Reportes ejecutivos diarios -------------------------------------------------------------
insert into public.daily_reports (organization_id, report_date, summary, coverage_note, metrics, is_synthetic)
select v.org::uuid, (now() at time zone 'America/Bogota')::date - v.days_ago, '[SINTÉTICO] ' || v.summary,
       'Cobertura parcial: datos sintéticos de QA. Instagram y Facebook propios completos; X solo menciones directas; sin TikTok ni menciones de terceros.',
       v.metrics::jsonb, true
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 0, 'Dos señales críticas: posible noticia de infección (pendiente de revisión) y amenaza de tutela (incidente en investigación). Pico de reclamos por la app, ya resuelto.', '{"items": 14, "negative_pct": 64, "alerts_open": 3, "incidents_open": 1}'),
  ('9a000000-0000-4000-a000-0000000000a1', 1, 'Conversación estable; quejas por tiempos de espera en especialistas.', '{"items": 9, "negative_pct": 44, "alerts_open": 1, "incidents_open": 0}'),
  ('9a000000-0000-4000-a000-0000000000a1', 2, 'Elogios por la jornada de vacunación; sin alertas.', '{"items": 7, "negative_pct": 14, "alerts_open": 0, "incidents_open": 0}'),
  ('9b000000-0000-4000-a000-0000000000b1', 0, 'Posible fraude reportado (pendiente de revisión) y caída de la app en quincena (incidente abierto).', '{"items": 6, "negative_pct": 50, "alerts_open": 2, "incidents_open": 1}'),
  ('9b000000-0000-4000-a000-0000000000b1', 1, 'Conversación positiva sobre productos.', '{"items": 4, "negative_pct": 0, "alerts_open": 0, "incidents_open": 0}')
) as v(org, days_ago, summary, metrics)
on conflict (organization_id, report_date) do nothing;

-- 10. Presupuestos, uso de IA y WhatsApp simulado ----------------------------------------------
insert into public.usage_budgets (organization_id, ai_monthly_usd, ai_daily_items, whatsapp_monthly_usd, hard_stop) values
  ('9a000000-0000-4000-a000-0000000000a1', 30, 2000, 5, true),
  ('9b000000-0000-4000-a000-0000000000b1', 30, 2000, 5, true)
on conflict (organization_id) do nothing;

insert into public.ai_usage (organization_id, task, provider, model, input_tokens, output_tokens, cost_usd, cache_hit, created_at)
select v.org::uuid, v.task, 'heuristic', 'qa-seed', 0, 0, 0, v.cache, now() - (v.hours || ' hours')::interval
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'classify_item', false, 1), ('9a000000-0000-4000-a000-0000000000a1', 'classify_item', true, 2),
  ('9a000000-0000-4000-a000-0000000000a1', 'daily_summary', false, 3), ('9b000000-0000-4000-a000-0000000000b1', 'classify_item', false, 1)
) as v(org, task, cache, hours)
where not exists (select 1 from public.ai_usage u where u.organization_id = v.org::uuid and u.model = 'qa-seed');

insert into public.whatsapp_recipients (organization_id, display_name, phone_e164, min_severity, opted_in_at, opt_in_evidence)
select v.org::uuid, v.name, v.phone, v.sev::public.hf_severity, now() - interval '10 days', '[SINTÉTICO] Opt-in ficticio de QA'
from (values
  ('9a000000-0000-4000-a000-0000000000a1', 'Destinatario sintético 1 (Aurora)', '+570000000001', 'critical'),
  ('9a000000-0000-4000-a000-0000000000a1', 'Destinatario sintético 2 (Aurora)', '+570000000002', 'high'),
  ('9b000000-0000-4000-a000-0000000000b1', 'Destinatario sintético 1 (Horizonte)', '+570000000101', 'critical')
) as v(org, name, phone, sev)
on conflict (organization_id, phone_e164) do nothing;

insert into public.notification_deliveries (organization_id, channel, recipient_id, alert_id, incident_id, template_name, mode, status, idempotency_key)
select '9a000000-0000-4000-a000-0000000000a1', 'whatsapp', r.id, '9a000000-0000-4000-8000-000000000002',
       '9a000000-0000-4000-7000-000000000001', 'hf_alerta_critica', 'simulate', 'simulated', 'qa-delivery-a-01'
from public.whatsapp_recipients r
where r.organization_id = '9a000000-0000-4000-a000-0000000000a1' and r.phone_e164 = '+570000000001'
on conflict (organization_id, idempotency_key) do nothing;

-- 11. Auditoría (append-only) ------------------------------------------------------------------
insert into public.audit_logs (organization_id, action, entity_type, entity_id, metadata)
select v.org::uuid, 'qa.seed', 'organization', v.org, '{"seed": "qa_seed.sql", "synthetic": true}'::jsonb
from (values ('9a000000-0000-4000-a000-0000000000a1'), ('9b000000-0000-4000-a000-0000000000b1')) as v(org)
where not exists (select 1 from public.audit_logs l where l.organization_id = v.org::uuid and l.action = 'qa.seed');

commit;
