-- Hey Foxy — ROLLBACK de 0006. NO es una migración: solo con GO explícito y solo en heyfoxy-qa.
-- Devuelve el esquema al contrato de 0005. Se pierden: medios referenciados (post_media), columnas
-- nuevas de métricas/autor/tipo y el estado de sincronización (se regeneran con una nueva sync).
-- Antes de ejecutarlo: vaciar el bucket hf-media desde Storage (las rutas las da post_media).
begin;
do $s$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists hf_media_member_read on storage.objects';
  end if;
  if to_regclass('storage.buckets') is not null then
    if exists (select 1 from storage.objects where bucket_id = 'hf-media') then
      raise exception 'El bucket hf-media no está vacío: vaciarlo antes del rollback';
    end if;
    delete from storage.buckets where id = 'hf-media';
  end if;
end
$s$;
drop function if exists public.hf_purge_expired_media(timestamptz);
drop table if exists public.post_media;
drop function if exists public.hf_guard_same_org_post();
alter table public.data_sources
  drop column if exists external_account_ref, drop column if exists external_account_label,
  drop column if exists connected_networks, drop column if exists last_sync_started_at,
  drop column if exists last_sync_finished_at, drop column if exists last_sync_status,
  drop column if exists last_sync_error, drop column if exists consecutive_failures,
  drop column if exists sync_cursor, drop column if exists api_calls_date,
  drop column if exists api_calls_today, drop column if exists max_api_calls_per_day;
alter table public.social_comments drop column if exists media_url;
alter table public.post_metric_snapshots
  drop column if exists impressions, drop column if exists impressions_unique, drop column if exists interactions,
  drop column if exists saves, drop column if exists video_views, drop column if exists engagement,
  drop column if exists reactions;
alter table public.social_posts
  drop column if exists content_type, drop column if exists title, drop column if exists author_display,
  drop column if exists author_handle, drop column if exists author_avatar_url, drop column if exists media_count_reported;
do $m$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where name = '20261124000600_hf_metricool_media_sync';
  end if;
end
$m$;
commit;
