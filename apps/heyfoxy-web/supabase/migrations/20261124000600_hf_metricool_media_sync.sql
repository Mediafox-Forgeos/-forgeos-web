-- Hey Foxy — 0006 Metricool: medios de publicaciones, métricas por red y estado de sincronización
--
-- GO 1 (2026-11-24): aplicar SOLO en heyfoxy-qa (admbpgqtgmaaofcgajzh). Probada localmente con
-- scripts/test-migration-0006.sh (Postgres efímero + stub de Storage) y tests/sql/40 (46 aserciones).
-- Incluye las guardas del GO 1: datos reales nunca en organizaciones demo, una marca por
-- organización y el interruptor de emergencia global en la base (hf_runtime_flags).
-- Aditiva: no cambia ni borra columnas, políticas ni grants existentes. Sigue el modelo de 0004:
-- primero se revoca todo en los objetos nuevos y después se concede exactamente lo necesario.
--
-- Decisiones (doc 16 §3 y WO-HF-METRICOOL-INTEGRATION-001 fase D, arquitectura híbrida):
--  * Medios por referencia externa (source_url) por defecto. Copia opcional de MINIATURAS en Storage
--    privado (bucket hf-media, ruta <organization_id>/…) solo si la fuente lo permite
--    (copy_allowed); nunca videos completos.
--  * URLs caducadas: url_status + checked_at; la interfaz cae a la miniatura copiada o al enlace
--    original, nunca a un medio inventado.
--  * Retención: retention_until por medio; hf_purge_expired_media() lo borra y devuelve las rutas de
--    Storage a eliminar (solo service_role).
--  * Aislamiento: RLS por organización en post_media y en storage.objects del bucket.

-- 1. Publicaciones: tipo de contenido y autor real de la fuente ---------------------------------
alter table public.social_posts
  add column if not exists content_type text
    check (content_type in ('image', 'video', 'carousel', 'reel', 'story', 'text', 'link', 'unknown')),
  add column if not exists title text,
  add column if not exists author_display text,
  add column if not exists author_handle text,
  add column if not exists author_avatar_url text,
  add column if not exists media_count_reported integer check (media_count_reported is null or media_count_reported >= 0);

-- 2. Métricas con su nombre real por red (nunca se equiparan alcance e impresiones únicas) ------
alter table public.post_metric_snapshots
  add column if not exists impressions integer,
  add column if not exists impressions_unique integer,
  add column if not exists interactions integer,
  add column if not exists saves integer,
  add column if not exists video_views integer,
  add column if not exists engagement numeric(9, 4),
  add column if not exists reactions jsonb;

-- 3. Comentarios con imagen -----------------------------------------------------------------
alter table public.social_comments add column if not exists media_url text;

-- 4. Medios de publicaciones ----------------------------------------------------------------
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 99),
  kind text not null check (kind in ('image', 'video')),
  source_url text not null check (source_url ~ '^https://'),
  preview_url text check (preview_url is null or preview_url ~ '^https://'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_sec numeric(8, 2) check (duration_sec is null or duration_sec >= 0),
  alt_text text,
  -- Copia controlada de miniatura (nunca video): ruta en el bucket privado hf-media.
  copy_allowed boolean not null default false,
  stored_object_path text,
  stored_at timestamptz,
  url_status text not null default 'unknown' check (url_status in ('unknown', 'ok', 'expired', 'removed')),
  checked_at timestamptz,
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, position),
  check (stored_object_path is null or (copy_allowed and stored_object_path like organization_id::text || '/%')),
  check (stored_object_path is null or kind = 'image' or preview_url is not null)
);
create index if not exists post_media_org_idx on public.post_media (organization_id, post_id);
create index if not exists post_media_retention_idx on public.post_media (retention_until) where retention_until is not null;

-- El medio pertenece a la misma organización que su publicación.
create or replace function public.hf_guard_same_org_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.social_posts p
                 where p.id = new.post_id and p.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists post_media_same_org on public.post_media;
create trigger post_media_same_org before insert or update on public.post_media
  for each row execute function public.hf_guard_same_org_post();

alter table public.post_media enable row level security;
drop policy if exists post_media_select on public.post_media;
create policy post_media_select on public.post_media for select to authenticated
  using (public.hf_is_member(organization_id));

-- 5. Estado de sincronización por fuente (lo escribe solo el servidor) ----------------------------
alter table public.data_sources
  add column if not exists external_account_ref text,      -- p. ej. blogId de Metricool (no es secreto)
  add column if not exists external_account_label text,    -- nombre de la marca en la fuente
  add column if not exists connected_networks text[] not null default '{}',
  add column if not exists last_sync_started_at timestamptz,
  add column if not exists last_sync_finished_at timestamptz,
  add column if not exists last_sync_status text
    check (last_sync_status in ('succeeded', 'partial', 'failed', 'stopped', 'skipped_paused', 'skipped_kill_switch',
                                'skipped_budget', 'skipped_not_connected', 'skipped_not_authorized')),
  add column if not exists last_sync_error text,
  add column if not exists consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  add column if not exists sync_cursor jsonb not null default '{}'::jsonb,
  add column if not exists api_calls_date date,
  add column if not exists api_calls_today integer not null default 0 check (api_calls_today >= 0),
  add column if not exists max_api_calls_per_day integer not null default 500 check (max_api_calls_per_day between 0 and 100000);

-- Una marca de la fuente (blogId) solo puede estar vinculada a UNA organización.
create unique index if not exists data_sources_external_account_uniq
  on public.data_sources (provider, external_account_ref) where external_account_ref is not null;

-- 5b. Datos reales nunca en organizaciones demo (Clínica Aurora, Banco Horizonte…) -------------
-- Una fuente real no puede quedar conectada en una organización demo, y ningún contenido no
-- sintético puede escribirse en ella. Complementa hf_guard_synthetic (0002).
create or replace function public.hf_guard_real_data_org()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_demo boolean;
begin
  select o.is_demo into v_demo from public.organizations o where o.id = new.organization_id;
  if not coalesce(v_demo, false) then
    return new;
  end if;
  if tg_table_name = 'data_sources' then
    if new.provider <> 'demo' and (new.status = 'connected' or new.external_account_ref is not null) then
      raise exception 'real source cannot be connected in a demo organization' using errcode = '23514';
    end if;
  elsif not new.is_synthetic then
    raise exception 'real (non-synthetic) content cannot be written in a demo organization' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists data_sources_real_data_org on public.data_sources;
create trigger data_sources_real_data_org before insert or update on public.data_sources
  for each row execute function public.hf_guard_real_data_org();
drop trigger if exists social_posts_real_data_org on public.social_posts;
create trigger social_posts_real_data_org before insert or update on public.social_posts
  for each row execute function public.hf_guard_real_data_org();
drop trigger if exists social_comments_real_data_org on public.social_comments;
create trigger social_comments_real_data_org before insert or update on public.social_comments
  for each row execute function public.hf_guard_real_data_org();
drop trigger if exists social_mentions_real_data_org on public.social_mentions;
create trigger social_mentions_real_data_org before insert or update on public.social_mentions
  for each row execute function public.hf_guard_real_data_org();
drop trigger if exists post_metric_snapshots_real_data_org on public.post_metric_snapshots;
create trigger post_metric_snapshots_real_data_org before insert or update on public.post_metric_snapshots
  for each row execute function public.hf_guard_real_data_org();

-- 5c. Interruptor de emergencia global en la base (efecto inmediato, sin redesplegar) ---------
-- El servidor lo consulta antes de cada llamada a la fuente. Solo service_role lo lee/escribe;
-- un operador lo activa con: update public.hf_runtime_flags set enabled = true,
--   reason = '…', updated_at = now() where flag = 'sync_kill_switch';
create table if not exists public.hf_runtime_flags (
  flag text primary key check (flag in ('sync_kill_switch')),
  enabled boolean not null default false,
  reason text,
  updated_at timestamptz not null default now()
);
alter table public.hf_runtime_flags enable row level security;
insert into public.hf_runtime_flags (flag, enabled) values ('sync_kill_switch', false)
  on conflict (flag) do nothing;

-- 6. Retención de medios ----------------------------------------------------------------------
create or replace function public.hf_purge_expired_media(p_now timestamptz default now())
returns table (organization_id uuid, stored_object_path text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  delete from public.post_media m
  where m.retention_until is not null and m.retention_until <= p_now
  returning m.organization_id, m.stored_object_path;
end;
$$;

-- 7. Privilegios explícitos (modelo 0004) -------------------------------------------------------
revoke all on table public.post_media from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.post_media to service_role;
grant select on table public.post_media to authenticated;
revoke all on function public.hf_guard_same_org_post() from public, anon, authenticated, service_role;
revoke all on function public.hf_guard_real_data_org() from public, anon, authenticated, service_role;
revoke all on table public.hf_runtime_flags from public, anon, authenticated, service_role;
grant select, update on table public.hf_runtime_flags to service_role;
revoke all on function public.hf_purge_expired_media(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.hf_purge_expired_media(timestamptz) to service_role;
-- data_sources: las columnas nuevas se leen con el SELECT ya concedido; authenticated sigue sin
-- poder escribirlas (solo display_name, ingestion_paused, max_items_per_day, poll_interval_minutes).

-- 8. Storage: bucket privado de miniaturas, aislado por organización -----------------------------
do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Esquema storage no disponible: se omite el bucket hf-media';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('hf-media', 'hf-media', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

  -- Lectura: miembros de la organización de la primera carpeta. Escritura: solo service_role
  -- (sin políticas de escritura para authenticated).
  execute 'drop policy if exists hf_media_member_read on storage.objects';
  execute $p$create policy hf_media_member_read on storage.objects for select to authenticated
    using (bucket_id = 'hf-media'
           and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
           and public.hf_is_member(((storage.foldername(name))[1])::uuid))$p$;
end
$storage$;
