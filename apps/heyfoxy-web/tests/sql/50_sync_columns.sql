-- Columnas de las tablas que escribe la sincronización Metricool (contrato tests/schema).
select jsonb_pretty(jsonb_object_agg(table_name, cols order by table_name))
from (
  select table_name, jsonb_agg(column_name::text order by column_name) as cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('data_sources', 'ingestion_jobs', 'post_media', 'post_metric_snapshots',
                       'social_comments', 'social_posts', 'source_coverage')
  group by table_name
) t;
