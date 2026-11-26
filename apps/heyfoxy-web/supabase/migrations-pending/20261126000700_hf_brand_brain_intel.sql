-- Hey Foxy — 0007 Foxy Brand Brain, memoria estratégica e inteligencia de contenido
--
-- WO-HF-V2-INTELLIGENCE-001 (+ addendum). PREPARADA, NO APLICADA EN NINGÚN REMOTO: vive en
-- migrations-pending/ y se prueba con scripts/test-migration-0007.sh. Aplicarla en heyfoxy-qa
-- requiere un GO independiente.
--
-- Aditiva. Sigue el modelo 0004/0006: se revoca todo en los objetos nuevos y se concede
-- exactamente lo necesario.
--  * brand_contexts: contexto estratégico autorizado de la marca (Brand Brain). Lo leen los
--    miembros; solo owner/admin lo editan (validación humana; Foxy nunca lo modifica).
--  * brand_memory: memoria estratégica (aprendizajes, decisiones, recomendaciones aceptadas o
--    descartadas, resultados de pruebas). Se proponen y un owner/admin las valida.
--  * content_intel_cache: caché de análisis de Foxy por hash de entrada (evita analizar dos
--    veces lo que no cambió). Solo escribe el servidor.
--  * hf_runtime_flags admite 'ai_kill_switch' (interruptor inmediato del motor de IA).
-- La biblioteca documental (PDF, briefs, manuales) y la búsqueda semántica quedan fuera: ver
-- doc 21 §Brand Brain (evolución).

-- 1. Brand Brain ------------------------------------------------------------------------------
create table if not exists public.brand_contexts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- A. Identidad: name, description, industry, valueProposition, positioning, personality,
  --    tone, visualGuidelines, brandManualRef
  identity jsonb not null default '{}'::jsonb check (jsonb_typeof(identity) = 'object'),
  -- B. Estrategia: marketing, communication, organic, businessGoals[], communicationGoals[],
  --    pillars[{name,description}], audiences[], consumerInsights[], kpis[], competitors[]
  strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy) = 'object'),
  -- C. Campañas: [{name,status(active|past),concept,goals,audiences,keyMessages,channels,
  --    results,learnings,startsOn,endsOn}]
  campaigns jsonb not null default '[]'::jsonb check (jsonb_typeof(campaigns) = 'array'),
  is_synthetic boolean not null default false,
  version integer not null default 1 check (version >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (pg_column_size(identity) + pg_column_size(strategy) + pg_column_size(campaigns) < 262144)
);

-- Cada edición incrementa la versión y registra quién la hizo (trazabilidad de la estrategia).
create or replace function public.hf_brand_context_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists brand_contexts_version on public.brand_contexts;
create trigger brand_contexts_version before insert or update on public.brand_contexts
  for each row execute function public.hf_brand_context_version();

alter table public.brand_contexts enable row level security;
drop policy if exists brand_contexts_select on public.brand_contexts;
create policy brand_contexts_select on public.brand_contexts for select to authenticated
  using (public.hf_is_member(organization_id));
drop policy if exists brand_contexts_insert on public.brand_contexts;
create policy brand_contexts_insert on public.brand_contexts for insert to authenticated
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
drop policy if exists brand_contexts_update on public.brand_contexts;
create policy brand_contexts_update on public.brand_contexts for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));

-- 2. Memoria estratégica -----------------------------------------------------------------------
create table if not exists public.brand_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('learning', 'decision', 'recommendation_accepted',
                                     'recommendation_dismissed', 'test_result')),
  title text not null check (length(trim(title)) between 3 and 200),
  body text not null check (length(body) between 1 and 4000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  source_post_id uuid references public.social_posts(id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'validated', 'archived')),
  is_synthetic boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'validated') = (validated_at is not null))
);
create index if not exists brand_memory_org_idx on public.brand_memory (organization_id, created_at desc);

-- La publicación de evidencia pertenece a la misma organización.
create or replace function public.hf_guard_brand_memory_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source_post_id is not null and not exists (
    select 1 from public.social_posts p
    where p.id = new.source_post_id and p.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated') then
    new.validated_by := coalesce(auth.uid(), new.validated_by);
    new.validated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists brand_memory_guard on public.brand_memory;
create trigger brand_memory_guard before insert or update on public.brand_memory
  for each row execute function public.hf_guard_brand_memory_org();

alter table public.brand_memory enable row level security;
drop policy if exists brand_memory_select on public.brand_memory;
create policy brand_memory_select on public.brand_memory for select to authenticated
  using (public.hf_is_member(organization_id));
-- Proponer: owner, admin o analyst; siempre como propuesta (la validación es humana y aparte).
drop policy if exists brand_memory_insert on public.brand_memory;
create policy brand_memory_insert on public.brand_memory for insert to authenticated
  with check (status = 'proposed'
              and public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[]));
-- Validar o archivar: owner o admin.
drop policy if exists brand_memory_update on public.brand_memory;
create policy brand_memory_update on public.brand_memory for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));

-- 3. Caché de inteligencia de contenido -------------------------------------------------------
create table if not exists public.content_intel_cache (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null check (subject_type in ('post', 'question')),
  subject_key text not null check (length(subject_key) between 1 and 200),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{40,64}$'),
  provider text not null,
  model text not null,
  prompt_version text not null,
  output jsonb not null check (jsonb_typeof(output) = 'object'),
  input_is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  unique (organization_id, subject_type, input_hash)
);
create index if not exists content_intel_cache_subject_idx
  on public.content_intel_cache (organization_id, subject_type, subject_key, created_at desc);
alter table public.content_intel_cache enable row level security;
drop policy if exists content_intel_cache_select on public.content_intel_cache;
create policy content_intel_cache_select on public.content_intel_cache for select to authenticated
  using (public.hf_is_member(organization_id));

-- 4. Interruptor del motor de IA -------------------------------------------------------------
alter table public.hf_runtime_flags drop constraint if exists hf_runtime_flags_flag_check;
alter table public.hf_runtime_flags add constraint hf_runtime_flags_flag_check
  check (flag in ('sync_kill_switch', 'ai_kill_switch'));
insert into public.hf_runtime_flags (flag, enabled) values ('ai_kill_switch', false)
  on conflict (flag) do nothing;

-- 5. Privilegios explícitos ---------------------------------------------------------------------
revoke all on table public.brand_contexts from public, anon, authenticated, service_role;
grant select, insert, update on table public.brand_contexts to authenticated;
grant select, insert, update, delete on table public.brand_contexts to service_role;
revoke all on table public.brand_memory from public, anon, authenticated, service_role;
grant select, insert, update on table public.brand_memory to authenticated;
grant select, insert, update, delete on table public.brand_memory to service_role;
revoke all on table public.content_intel_cache from public, anon, authenticated, service_role;
grant select on table public.content_intel_cache to authenticated;
grant select, insert, delete on table public.content_intel_cache to service_role;
revoke all on function public.hf_brand_context_version() from public, anon, authenticated, service_role;
revoke all on function public.hf_guard_brand_memory_org() from public, anon, authenticated, service_role;
