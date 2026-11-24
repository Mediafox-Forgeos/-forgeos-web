-- Hey Foxy · QA · corrección de datos sintéticos 002: reparto de fechas (Fase B, WO-HF-METRICOOL-INTEGRATION-001)
--
-- PREPARADO, NO EJECUTADO. Requiere GO explícito con este archivo y su md5. Ejecutar DESPUÉS de
-- qa_fix_001 y ANTES de qa_refresh_dates. Antes de aplicarlo, ejecutar qa_dates_rollback_export.sql
-- (solo lectura) y guardar su salida: es el script de rollback.
--
-- Problema: el seed fecha todo entre 1 y 72 h antes de la carga, así que los periodos de 7, 14 y
-- 30 días muestran lo mismo y no hay periodo anterior comparable.
-- Corrección (una sola vez): reparte comentarios y menciones del seed entre ~1 h y 27 días según su
-- orden original (el más reciente sigue siendo el más reciente), y recoloca lo que depende de ellos.
--
-- Alcance estricto: solo las 2 organizaciones QA (is_demo) y solo filas del seed:
--   social_comments / social_mentions (is_synthetic, external_id 'qa-…'), social_posts (is_synthetic,
--   external_id 'qa-post-…'), post_metric_snapshots (is_synthetic de esas publicaciones),
--   sentiment_analyses (provider 'heuristic', model 'qa-seed'), alerts del seed (is_synthetic, analysis_id).
-- NO toca: usuarios, membresías, incidentes, incident_events ni audit_logs (historial append-only),
-- ni filas creadas a mano durante la validación (is_synthetic = false o fuera del seed).
-- Marca de una sola ejecución: inserta un registro en audit_logs y aborta si ya existe.

begin;

do $fix$
declare
  orgs constant uuid[] := array['9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1']::uuid[];
  anchor constant timestamptz := now() - interval '1 hour';
  max_age constant interval := interval '27 days';
  n int;
begin
  if (select count(*) from public.organizations where id = any(orgs) and is_demo) <> 2 then
    raise exception 'Abortado: no están las 2 organizaciones QA marcadas is_demo';
  end if;
  if exists (select 1 from public.audit_logs where action = 'qa_fix_002_date_spread' and organization_id = any(orgs)) then
    raise exception 'Abortado: qa_fix_002 ya se aplicó (marca en audit_logs). Usar qa_refresh_dates.sql';
  end if;

  -- 1. Comentarios y menciones del seed: edad por rango dentro de cada organización (curva 1,3).
  create temp table qa_new_ts on commit drop as
  with items as (
    select 'comment' as kind, c.id, c.organization_id as org, c.published_at
    from public.social_comments c
    where c.organization_id = any(orgs) and c.is_synthetic and c.external_id like 'qa-c-%'
    union all
    select 'mention', m.id, m.organization_id, m.published_at
    from public.social_mentions m
    where m.organization_id = any(orgs) and m.is_synthetic and m.external_id like 'qa-m-%'
  ), ranked as (
    select i.*, row_number() over (partition by org order by published_at desc, id) - 1 as k,
           count(*) over (partition by org) as n_org
    from items i
  )
  select kind, id, org,
         anchor - (max_age * power(k::numeric / greatest(n_org - 1, 1), 1.3)) as ts
  from ranked;

  update public.social_comments c set published_at = t.ts
  from qa_new_ts t where t.kind = 'comment' and c.id = t.id;
  get diagnostics n = row_count; raise notice 'comentarios: %', n;

  update public.social_mentions m set published_at = t.ts
  from qa_new_ts t where t.kind = 'mention' and m.id = t.id;
  get diagnostics n = row_count; raise notice 'menciones: %', n;

  -- 2. Análisis del seed: 5 min después de su comentario.
  update public.sentiment_analyses s set created_at = c.published_at + interval '5 minutes'
  from public.social_comments c
  where s.item_type = 'comment' and s.item_id = c.id and c.organization_id = any(orgs)
    and s.provider = 'heuristic' and s.model = 'qa-seed';
  get diagnostics n = row_count; raise notice 'análisis: %', n;

  -- 3. Publicaciones: 3 h antes de su primer comentario.
  create temp table qa_post_shift on commit drop as
  select p.id, p.published_at as old_ts,
         (select min(c.published_at) from public.social_comments c where c.post_id = p.id) - interval '3 hours' as new_ts
  from public.social_posts p
  where p.organization_id = any(orgs) and p.is_synthetic and p.external_id like 'qa-post-%';

  update public.social_posts p set published_at = s.new_ts
  from qa_post_shift s where p.id = s.id and s.new_ts is not null;
  get diagnostics n = row_count; raise notice 'publicaciones: %', n;

  -- 4. Mediciones: mismo desfase que su publicación; nunca en el futuro.
  update public.post_metric_snapshots m
  set captured_at = least(m.captured_at + (s.new_ts - s.old_ts), now() - interval '30 minutes')
  from qa_post_shift s
  where m.post_id = s.id and m.is_synthetic and s.new_ts is not null;
  get diagnostics n = row_count; raise notice 'mediciones: %', n;

  -- 5. Alertas del seed ligadas a un comentario: 20 min después de él.
  update public.alerts a set created_at = c.published_at + interval '20 minutes'
  from public.sentiment_analyses s join public.social_comments c on c.id = s.item_id
  where a.analysis_id = s.id and a.organization_id = any(orgs) and a.is_synthetic
    and a.dedupe_key like 'qa-alert-%';
  get diagnostics n = row_count; raise notice 'alertas: %', n;

  insert into public.audit_logs (organization_id, action, entity_type, metadata)
  select o, 'qa_fix_002_date_spread', 'qa_seed', jsonb_build_object('anchor', anchor, 'max_age_days', 27)
  from unnest(orgs) o;
end
$fix$;

-- Verificación: comentarios después de su publicación; nada en el futuro.
do $chk$
begin
  if exists (select 1 from public.social_comments c join public.social_posts p on p.id = c.post_id
             where c.is_synthetic and c.external_id like 'qa-c-%' and c.published_at < p.published_at) then
    raise exception 'Hay comentarios anteriores a su publicación';
  end if;
  if exists (select 1 from public.social_comments where is_synthetic and published_at > now())
     or exists (select 1 from public.post_metric_snapshots where is_synthetic and captured_at > now()) then
    raise exception 'Hay fechas en el futuro';
  end if;
end
$chk$;

commit;
