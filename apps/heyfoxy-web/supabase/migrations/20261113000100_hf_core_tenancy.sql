-- Hey Foxy — 0001 core tenancy (WO-MFOX-HEYFOXY-001 Gate 2)
-- Multiempresa estricto: toda fila de negocio lleva organization_id y RLS.
-- Autoridad de acceso = base de datos (RLS). La app nunca confía en el cliente.

create extension if not exists pgcrypto;

create type public.hf_role as enum ('owner', 'admin', 'analyst', 'responder', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'pilot' check (plan in ('pilot', 'starter', 'professional', 'enterprise')),
  is_demo boolean not null default false,
  retention_days integer not null default 90 check (retention_days between 7 and 1095),
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index brands_org_idx on public.brands (organization_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.hf_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Personal de plataforma (soporte MediaFOX). NO otorga acceso a datos de clientes
-- por sí mismo: se usa solo para operaciones de backoffice vía service role.
create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Auditoría append-only.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers de autorización. SECURITY DEFINER con search_path fijo para evitar
-- recursión de RLS en memberships y secuestro de search_path.
-- ---------------------------------------------------------------------------
create or replace function public.hf_is_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.hf_has_role(org uuid, roles public.hf_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

revoke all on function public.hf_is_member(uuid) from public;
revoke all on function public.hf_has_role(uuid, public.hf_role[]) from public;
grant execute on function public.hf_is_member(uuid) to authenticated;
grant execute on function public.hf_has_role(uuid, public.hf_role[]) to authenticated;

create or replace function public.hf_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.hf_touch_updated_at();

-- Append-only guard reutilizable.
create or replace function public.hf_forbid_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'append-only table: % not allowed on %', tg_op, tg_table_name
    using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.hf_forbid_mutation();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.brands enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_staff enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated using (public.hf_is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.hf_has_role(id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(id, array['owner','admin']::public.hf_role[]));

create policy brands_select on public.brands
  for select to authenticated using (public.hf_is_member(organization_id));
create policy brands_write on public.brands
  for all to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));

create policy memberships_select on public.memberships
  for select to authenticated using (public.hf_is_member(organization_id));
-- Altas/bajas de miembros: solo owner/admin; nadie puede auto-promoverse a owner
-- salvo un owner existente.
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (
    public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[])
    and (role <> 'owner' or public.hf_has_role(organization_id, array['owner']::public.hf_role[]))
  );
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (
    public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[])
    and (role <> 'owner' or public.hf_has_role(organization_id, array['owner']::public.hf_role[]))
  );
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));

-- platform_staff: sin políticas => inaccesible para authenticated/anon.

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null
         and public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (organization_id is not null
              and public.hf_is_member(organization_id)
              and actor_user_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
-- Append-only también a nivel de privilegios (defensa en profundidad).
revoke update, delete, truncate on public.audit_logs from authenticated, anon;
