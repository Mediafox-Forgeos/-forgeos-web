-- Hey Foxy — 0002 fuentes, cobertura y contenido
-- Requisitos: B (cobertura real por fuente/cuenta/periodo/tipo), C (fuentes no
-- conectadas o sin permisos visibles), D (no presentar parcial como total),
-- H (datos ficticios identificados), I (límites de ingesta, anti-duplicados),
-- J (solo proveedores autorizados; sin scraping).

create type public.hf_platform as enum
  ('facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'web', 'other');
create type public.hf_provider as enum
  ('metricool', 'meta_graph', 'youtube_data', 'linkedin_cm', 'x_api', 'licensed_feed', 'demo');
create type public.hf_source_status as enum
  ('not_connected', 'pending_authorization', 'connected', 'insufficient_permissions', 'error', 'disabled');
create type public.hf_data_kind as enum
  ('posts', 'post_metrics', 'comments', 'mentions', 'direct_messages', 'reviews');
create type public.hf_coverage_status as enum
  ('complete', 'partial', 'unavailable', 'not_permitted', 'not_requested');

-- Una fuente = un proveedor configurado para una organización.
create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.hf_provider not null,
  display_name text not null,
  status public.hf_source_status not null default 'not_connected',
  status_reason text,
  -- Límites de ingesta (requisito I).
  max_items_per_day integer not null default 5000 check (max_items_per_day between 0 and 1000000),
  poll_interval_minutes integer not null default 30 check (poll_interval_minutes between 5 and 1440),
  ingestion_paused boolean not null default true,
  authorized_by uuid,
  authorized_at timestamptz,
  authorization_reference text, -- p.ej. referencia del documento de autorización del cliente
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create trigger data_sources_touch before update on public.data_sources
  for each row execute function public.hf_touch_updated_at();

-- Cuentas sociales observadas. ownership distingue cuentas propias (autorizadas)
-- de perfiles públicos de referencia (solo métricas públicas permitidas).
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  platform public.hf_platform not null,
  external_id text not null,
  handle text,
  ownership text not null check (ownership in ('owned', 'public_reference')),
  status public.hf_source_status not null default 'not_connected',
  created_at timestamptz not null default now(),
  unique (organization_id, platform, external_id)
);
create index social_accounts_org_idx on public.social_accounts (organization_id);

-- Matriz de cobertura real (requisito B/C/D). Una fila por cuenta x tipo de dato
-- x periodo. La UI la usa para declarar explícitamente qué NO se escucha.
create table public.source_coverage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete cascade,
  platform public.hf_platform not null,
  data_kind public.hf_data_kind not null,
  status public.hf_coverage_status not null,
  reason text,
  period_start timestamptz not null,
  period_end timestamptz,
  items_ingested integer not null default 0 check (items_ingested >= 0),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end is null or period_end >= period_start)
);
create index source_coverage_org_idx on public.source_coverage (organization_id, platform, data_kind);

-- Credenciales: cifradas (AES-256-GCM, envelope). SIN políticas RLS para
-- authenticated => solo service role (servidor) puede leer/escribir.
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  key_version integer not null default 1,
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (data_source_id, key_version)
);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  platform public.hf_platform not null,
  external_id text not null,
  permalink text,
  body text,
  published_at timestamptz,
  is_synthetic boolean not null default false,
  deleted_at_source timestamptz,
  ingested_at timestamptz not null default now(),
  unique (organization_id, data_source_id, external_id)
);
create index social_posts_org_idx on public.social_posts (organization_id, published_at desc);

create table public.post_metric_snapshots (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  likes integer, comments integer, shares integer, views integer, reach integer,
  is_synthetic boolean not null default false
);
create index post_metric_snapshots_post_idx on public.post_metric_snapshots (post_id, captured_at desc);

-- Comentarios y menciones: misma forma ("items" de conversación).
-- author_hash = HMAC del id del autor (minimización de PII); author_display
-- se elimina al vencer retención.
create table public.social_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  post_id uuid references public.social_posts(id) on delete set null,
  platform public.hf_platform not null,
  external_id text not null,
  parent_external_id text,
  body text not null,
  author_hash text,
  author_display text,
  published_at timestamptz not null,
  content_hash text not null, -- dedupe semántico (requisito I)
  is_synthetic boolean not null default false,
  deleted_at_source timestamptz,
  ingested_at timestamptz not null default now(),
  unique (organization_id, data_source_id, external_id)
);
create index social_comments_org_time_idx on public.social_comments (organization_id, published_at desc);
create index social_comments_hash_idx on public.social_comments (organization_id, content_hash);

create table public.social_mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  platform public.hf_platform not null,
  external_id text not null,
  permalink text,
  body text not null,
  author_hash text,
  author_display text,
  published_at timestamptz not null,
  content_hash text not null,
  is_synthetic boolean not null default false,
  deleted_at_source timestamptz,
  ingested_at timestamptz not null default now(),
  unique (organization_id, data_source_id, external_id)
);
create index social_mentions_org_time_idx on public.social_mentions (organization_id, published_at desc);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  data_kind public.hf_data_kind not null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','skipped_budget','skipped_paused')),
  cursor text,
  items_fetched integer not null default 0,
  items_inserted integer not null default 0,
  items_duplicated integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index ingestion_jobs_org_idx on public.ingestion_jobs (organization_id, created_at desc);

-- Requisito I/H: un item sintético solo puede existir en una organización demo
-- o venir del proveedor demo; y el proveedor demo solo puede escribir sintéticos.
create or replace function public.hf_guard_synthetic()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_provider public.hf_provider;
begin
  select provider into v_provider from public.data_sources where id = new.data_source_id;
  if v_provider = 'demo' and not new.is_synthetic then
    raise exception 'demo provider can only write synthetic rows' using errcode = '23514';
  end if;
  if v_provider <> 'demo' and new.is_synthetic then
    raise exception 'synthetic rows must come from the demo provider' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger social_posts_synthetic before insert or update on public.social_posts
  for each row execute function public.hf_guard_synthetic();
create trigger social_comments_synthetic before insert or update on public.social_comments
  for each row execute function public.hf_guard_synthetic();
create trigger social_mentions_synthetic before insert or update on public.social_mentions
  for each row execute function public.hf_guard_synthetic();

-- Coherencia multiempresa: hijos deben pertenecer a la misma organización que la fuente.
create or replace function public.hf_guard_same_org_source()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.data_sources d
                 where d.id = new.data_source_id and d.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger social_accounts_same_org before insert or update on public.social_accounts
  for each row execute function public.hf_guard_same_org_source();
create trigger source_coverage_same_org before insert or update on public.source_coverage
  for each row execute function public.hf_guard_same_org_source();
create trigger integration_credentials_same_org before insert or update on public.integration_credentials
  for each row execute function public.hf_guard_same_org_source();
create trigger social_posts_same_org before insert or update on public.social_posts
  for each row execute function public.hf_guard_same_org_source();
create trigger social_comments_same_org before insert or update on public.social_comments
  for each row execute function public.hf_guard_same_org_source();
create trigger social_mentions_same_org before insert or update on public.social_mentions
  for each row execute function public.hf_guard_same_org_source();
create trigger ingestion_jobs_same_org before insert or update on public.ingestion_jobs
  for each row execute function public.hf_guard_same_org_source();

-- RLS ------------------------------------------------------------------------
alter table public.data_sources enable row level security;
alter table public.social_accounts enable row level security;
alter table public.source_coverage enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.social_posts enable row level security;
alter table public.post_metric_snapshots enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_mentions enable row level security;
alter table public.ingestion_jobs enable row level security;

-- Lectura para miembros. Escritura de contenido: solo servidor (service role).
create policy data_sources_select on public.data_sources for select to authenticated
  using (public.hf_is_member(organization_id));
create policy data_sources_update on public.data_sources for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
create policy social_accounts_select on public.social_accounts for select to authenticated
  using (public.hf_is_member(organization_id));
create policy source_coverage_select on public.source_coverage for select to authenticated
  using (public.hf_is_member(organization_id));
create policy social_posts_select on public.social_posts for select to authenticated
  using (public.hf_is_member(organization_id));
create policy post_metric_snapshots_select on public.post_metric_snapshots for select to authenticated
  using (public.hf_is_member(organization_id));
create policy social_comments_select on public.social_comments for select to authenticated
  using (public.hf_is_member(organization_id));
create policy social_mentions_select on public.social_mentions for select to authenticated
  using (public.hf_is_member(organization_id));
create policy ingestion_jobs_select on public.ingestion_jobs for select to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[]));
-- integration_credentials: sin políticas (ni lectura) para authenticated.
revoke all on public.integration_credentials from authenticated, anon;
-- Owner/admin solo pueden pausar o ajustar límites; el estado de conexión y la
-- autorización los escribe exclusivamente el servidor (service role).
revoke update on public.data_sources from authenticated;
grant update (display_name, ingestion_paused, max_items_per_day, poll_interval_minutes)
  on public.data_sources to authenticated;
