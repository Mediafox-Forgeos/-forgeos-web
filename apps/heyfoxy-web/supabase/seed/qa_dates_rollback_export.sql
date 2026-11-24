-- Hey Foxy · QA · exportación de fechas para rollback (SOLO LECTURA)
--
-- Ejecutar ANTES de qa_fix_002 / qa_refresh_dates y guardar la salida fuera del repositorio
-- (p. ej. /Volumes/MediaFOX_DEV/QA/HeyFoxy/…). La salida es un script SQL que restaura cada fecha
-- del alcance a su valor actual, fila por fila. No escribe nada.

with o(id) as (values ('9a000000-0000-4000-a000-0000000000a1'::uuid), ('9b000000-0000-4000-a000-0000000000b1'::uuid)),
rows as (
  select format('update public.social_comments set published_at = %L where id = %L;', published_at, id) as stmt
  from public.social_comments where organization_id in (select id from o) and is_synthetic and external_id like 'qa-c-%'
  union all
  select format('update public.social_mentions set published_at = %L where id = %L;', published_at, id)
  from public.social_mentions where organization_id in (select id from o) and is_synthetic and external_id like 'qa-m-%'
  union all
  select format('update public.social_posts set published_at = %L where id = %L;', published_at, id)
  from public.social_posts where organization_id in (select id from o) and is_synthetic and external_id like 'qa-post-%'
  union all
  select format('update public.post_metric_snapshots set captured_at = %L where id = %L;', m.captured_at, m.id)
  from public.post_metric_snapshots m join public.social_posts p on p.id = m.post_id
  where p.organization_id in (select id from o) and m.is_synthetic and p.external_id like 'qa-post-%'
  union all
  select format('update public.sentiment_analyses set created_at = %L, reviewed_at = %L where id = %L;', created_at, reviewed_at, id)
  from public.sentiment_analyses where organization_id in (select id from o) and provider = 'heuristic' and model = 'qa-seed'
  union all
  select format('update public.alerts set created_at = %L, reviewed_at = %L where id = %L;', created_at, reviewed_at, id)
  from public.alerts where organization_id in (select id from o) and is_synthetic and dedupe_key like 'qa-alert-%'
  union all
  select format('update public.conversation_clusters set window_start = %L, window_end = %L where id = %L;', window_start, window_end, id)
  from public.conversation_clusters where organization_id in (select id from o) and id::text like '9_000000-0000-4000-f000-%'
  union all
  select format('update public.source_coverage set period_start = %L, last_success_at = %L where id = %L;', sc.period_start, sc.last_success_at, sc.id)
  from public.source_coverage sc join public.data_sources d on d.id = sc.data_source_id
  where sc.organization_id in (select id from o) and d.provider = 'demo'
)
select 'begin;' as stmt
union all select stmt from rows
union all select 'commit;';
