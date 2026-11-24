-- Hey Foxy · QA · actualización de fechas del seed (repetible; SOLO heyfoxy-qa)
--
-- PREPARADO, NO EJECUTADO. Primera ejecución con GO explícito (archivo + md5); después puede
-- programarse (p. ej. semanal) también con GO. Requiere qa_fix_002 aplicado.
--
-- Desplaza en bloque todas las fechas del seed para que lo más reciente quede ~1 h atrás,
-- conservando las distancias entre filas (los periodos de 7, 14 y 30 días siguen siendo distintos).
-- Idempotente: si lo más reciente ya tiene < 2 h, no hace nada.
--
-- Mismo alcance que qa_fix_002 (filas del seed de las 2 organizaciones QA) más las ventanas de los
-- clusters y la cobertura del seed. NO toca usuarios, incidentes, incident_events ni audit_logs
-- (historial append-only): esos conservan su fecha real.
-- Rollback: desplazar con el delta inverso que informa el NOTICE (o qa_dates_rollback_export.sql).

begin;

do $refresh$
declare
  orgs constant uuid[] := array['9a000000-0000-4000-a000-0000000000a1', '9b000000-0000-4000-a000-0000000000b1']::uuid[];
  newest timestamptz;
  delta interval;
  n int;
begin
  if (select count(*) from public.organizations where id = any(orgs) and is_demo) <> 2 then
    raise exception 'Abortado: no están las 2 organizaciones QA marcadas is_demo';
  end if;
  if not exists (select 1 from public.audit_logs where action = 'qa_fix_002_date_spread' and organization_id = any(orgs)) then
    raise exception 'Abortado: aplicar antes qa_fix_002_date_spread.sql';
  end if;

  select max(ts) into newest from (
    select published_at as ts from public.social_comments
    where organization_id = any(orgs) and is_synthetic and external_id like 'qa-c-%'
    union all
    select published_at from public.social_mentions
    where organization_id = any(orgs) and is_synthetic and external_id like 'qa-m-%'
  ) x;
  delta := date_trunc('minute', (now() - interval '1 hour') - newest);
  if newest is null or delta < interval '1 hour' then
    raise notice 'Sin cambios: lo más reciente tiene menos de 2 h (delta %)', delta;
    return;
  end if;
  raise notice 'Desplazamiento aplicado: % (rollback: -%)', delta, delta;

  update public.social_comments set published_at = published_at + delta
  where organization_id = any(orgs) and is_synthetic and external_id like 'qa-c-%';
  get diagnostics n = row_count; raise notice 'comentarios: %', n;
  update public.social_mentions set published_at = published_at + delta
  where organization_id = any(orgs) and is_synthetic and external_id like 'qa-m-%';
  get diagnostics n = row_count; raise notice 'menciones: %', n;
  update public.social_posts set published_at = published_at + delta
  where organization_id = any(orgs) and is_synthetic and external_id like 'qa-post-%';
  get diagnostics n = row_count; raise notice 'publicaciones: %', n;
  update public.post_metric_snapshots m set captured_at = least(captured_at + delta, now() - interval '30 minutes')
  from public.social_posts p
  where m.post_id = p.id and m.is_synthetic and p.organization_id = any(orgs) and p.external_id like 'qa-post-%';
  get diagnostics n = row_count; raise notice 'mediciones: %', n;
  update public.sentiment_analyses s set created_at = least(created_at + delta, now()),
         reviewed_at = case when reviewed_at is not null then least(reviewed_at + delta, now()) end
  where s.organization_id = any(orgs) and s.provider = 'heuristic' and s.model = 'qa-seed';
  get diagnostics n = row_count; raise notice 'análisis: %', n;
  update public.alerts set created_at = least(created_at + delta, now()),
         reviewed_at = case when reviewed_at is not null then least(reviewed_at + delta, now()) end
  where organization_id = any(orgs) and is_synthetic and dedupe_key like 'qa-alert-%';
  get diagnostics n = row_count; raise notice 'alertas: %', n;
  update public.conversation_clusters set window_start = least(window_start + delta, now()), window_end = least(window_end + delta, now())
  where organization_id = any(orgs) and id::text like '9_000000-0000-4000-f000-%';
  update public.source_coverage
  set period_start = least(period_start + delta, now()),
      last_success_at = case when last_success_at is not null then least(last_success_at + delta, now()) end
  where organization_id = any(orgs)
    and data_source_id in (select id from public.data_sources where organization_id = any(orgs) and provider = 'demo');

  insert into public.audit_logs (organization_id, action, entity_type, metadata)
  select o, 'qa_refresh_dates', 'qa_seed', jsonb_build_object('delta', delta::text) from unnest(orgs) o;
end
$refresh$;

commit;
