-- Hey Foxy — 0003 inteligencia, alertas, incidentes, notificaciones, presupuestos
-- Requisitos: A (escucha operativa vs inteligencia reputacional), E (revisión
-- humana de críticas), F (incidentes con responsable/estado/historial/cierre),
-- G (WhatsApp individual), I (presupuestos IA).

create type public.hf_sentiment as enum ('positive', 'neutral', 'negative', 'mixed');
create type public.hf_severity as enum ('info', 'attention', 'high', 'critical');
create type public.hf_review_status as enum ('not_required', 'pending', 'confirmed', 'dismissed', 'adjusted');
create type public.hf_incident_status as enum
  ('open', 'acknowledged', 'investigating', 'responding', 'monitoring', 'resolved', 'closed', 'false_positive');

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, label)
);

-- Una clasificación por item y versión de modelo/prompt (trazabilidad).
create table public.sentiment_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null check (item_type in ('comment', 'mention')),
  item_id uuid not null,
  -- Capa: 'operational' = escucha operativa (responder/atender);
  --       'reputational' = señal reputacional agregada (requisito A).
  layer text not null check (layer in ('operational', 'reputational')),
  sentiment public.hf_sentiment not null,
  intent text not null check (intent in ('complaint','question','praise','purchase_intent','crisis_signal','spam','other')),
  topics text[] not null default '{}',
  severity public.hf_severity not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  explanation text not null check (length(explanation) between 1 and 600),
  priority_score numeric(5,2) not null check (priority_score between 0 and 100),
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_hash text not null,
  review_status public.hf_review_status not null default 'not_required',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, item_type, item_id, prompt_version, model)
);
create index sentiment_analyses_org_idx on public.sentiment_analyses (organization_id, created_at desc);
create index sentiment_analyses_review_idx on public.sentiment_analyses (organization_id, review_status)
  where review_status = 'pending';
-- Dedupe de costo: mismo input_hash + modelo => reutilizar resultado.
create index sentiment_analyses_hash_idx on public.sentiment_analyses (organization_id, input_hash, model);

create table public.conversation_clusters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  label text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  item_count integer not null default 0,
  negative_share numeric(4,3),
  baseline_ratio numeric(8,3),
  created_at timestamptz not null default now()
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  min_severity public.hf_severity not null default 'high',
  min_priority numeric(5,2) not null default 70 check (min_priority between 0 and 100),
  topics text[] not null default '{}',
  volume_spike_ratio numeric(6,2) check (volume_spike_ratio is null or volume_spike_ratio >= 1),
  notify_whatsapp boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_rule_id uuid references public.alert_rules(id) on delete set null,
  analysis_id uuid references public.sentiment_analyses(id) on delete set null,
  cluster_id uuid references public.conversation_clusters(id) on delete set null,
  title text not null,
  summary text not null,
  severity public.hf_severity not null,
  priority_score numeric(5,2) not null,
  -- Requisito E: crítica => requiere revisión humana antes de escalar externamente.
  review_status public.hf_review_status not null default 'not_required',
  reviewed_by uuid,
  reviewed_at timestamptz,
  dedupe_key text not null,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key),
  check (severity <> 'critical' or review_status <> 'not_required')
);
create index alerts_org_idx on public.alerts (organization_id, created_at desc);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_id uuid references public.alerts(id) on delete set null,
  title text not null,
  severity public.hf_severity not null,
  status public.hf_incident_status not null default 'open',
  owner_user_id uuid references auth.users(id) on delete set null,
  opened_by uuid,
  resolution_summary text,
  is_synthetic boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status not in ('closed','false_positive') or (closed_at is not null and resolution_summary is not null))
);
create index incidents_org_idx on public.incidents (organization_id, status, opened_at desc);
create trigger incidents_touch before update on public.incidents
  for each row execute function public.hf_touch_updated_at();

-- Historial append-only del incidente.
create table public.incident_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  actor_user_id uuid,
  kind text not null check (kind in ('opened','status_changed','assigned','note','notified','closed')),
  from_status public.hf_incident_status,
  to_status public.hf_incident_status,
  body text,
  created_at timestamptz not null default now()
);
create index incident_events_incident_idx on public.incident_events (incident_id, created_at);
create trigger incident_events_append_only before update or delete on public.incident_events
  for each row execute function public.hf_forbid_mutation();

-- FSM de incidentes en la base: transiciones válidas + evento automático.
create or replace function public.hf_incident_transition_allowed(f public.hf_incident_status, t public.hf_incident_status)
returns boolean language sql immutable set search_path = '' as $$
  select (f, t) in (
    ('open','acknowledged'), ('open','false_positive'),
    ('acknowledged','investigating'), ('acknowledged','false_positive'),
    ('investigating','responding'), ('investigating','monitoring'), ('investigating','false_positive'),
    ('responding','monitoring'), ('responding','resolved'),
    ('monitoring','responding'), ('monitoring','resolved'),
    ('resolved','closed'), ('resolved','investigating')
  );
$$;

create or replace function public.hf_incident_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open' then
      raise exception 'incidents must start open' using errcode = '23514';
    end if;
    insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, to_status, body)
    values (new.organization_id, new.id, new.opened_by, 'opened', 'open', new.title);
    return new;
  end if;
  if new.organization_id <> old.organization_id then
    raise exception 'organization_id is immutable' using errcode = '42501';
  end if;
  if new.status <> old.status then
    if not public.hf_incident_transition_allowed(old.status, new.status) then
      raise exception 'invalid incident transition % -> %', old.status, new.status using errcode = '23514';
    end if;
    if new.status in ('closed','false_positive') then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
    insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, from_status, to_status)
    values (new.organization_id, new.id, (select auth.uid()),
            case when new.status in ('closed','false_positive') then 'closed' else 'status_changed' end,
            old.status, new.status);
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    if new.owner_user_id is not null and not exists (
      select 1 from public.memberships m
      where m.organization_id = new.organization_id and m.user_id = new.owner_user_id
            and m.role in ('owner','admin','analyst','responder')) then
      raise exception 'incident owner must be a responder-capable member of the organization' using errcode = '42501';
    end if;
    insert into public.incident_events (organization_id, incident_id, actor_user_id, kind, body)
    values (new.organization_id, new.id, (select auth.uid()), 'assigned', new.owner_user_id::text);
  end if;
  return new;
end;
$$;
create trigger incidents_guard_insert after insert on public.incidents
  for each row execute function public.hf_incident_guard();
create trigger incidents_guard_update before update on public.incidents
  for each row execute function public.hf_incident_guard();

-- Destinatarios WhatsApp: individuales con opt-in explícito (requisito G).
create table public.whatsapp_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  min_severity public.hf_severity not null default 'high',
  opted_in_at timestamptz,
  opt_in_evidence text,
  opted_out_at timestamptz,
  quiet_hours int4range,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, phone_e164)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email','in_app')),
  recipient_id uuid references public.whatsapp_recipients(id) on delete set null,
  alert_id uuid references public.alerts(id) on delete set null,
  incident_id uuid references public.incidents(id) on delete set null,
  template_name text,
  mode text not null check (mode in ('simulate','sandbox','live')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','suppressed','simulated')),
  provider_message_id text,
  idempotency_key text not null,
  error text,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_date date not null,
  summary text not null,
  coverage_note text not null, -- requisito D: siempre declarar cobertura
  metrics jsonb not null default '{}'::jsonb,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, report_date)
);

-- Presupuestos de uso (requisito I).
create table public.usage_budgets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ai_monthly_usd numeric(10,2) not null default 30 check (ai_monthly_usd >= 0),
  ai_daily_items integer not null default 2000 check (ai_daily_items >= 0),
  whatsapp_monthly_usd numeric(10,2) not null default 5 check (whatsapp_monthly_usd >= 0),
  hard_stop boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_usage_org_month_idx on public.ai_usage (organization_id, created_at);

-- Same-org guards para filas hijas con FK a otra entidad tenant.
create or replace function public.hf_guard_incident_event_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.incidents i where i.id = new.incident_id and i.organization_id = new.organization_id) then
    raise exception 'cross-tenant reference rejected' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger incident_events_same_org before insert on public.incident_events
  for each row execute function public.hf_guard_incident_event_org();

-- RLS ------------------------------------------------------------------------
alter table public.topics enable row level security;
alter table public.sentiment_analyses enable row level security;
alter table public.conversation_clusters enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.whatsapp_recipients enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.daily_reports enable row level security;
alter table public.usage_budgets enable row level security;
alter table public.ai_usage enable row level security;

create policy topics_select on public.topics for select to authenticated using (public.hf_is_member(organization_id));
create policy sentiment_select on public.sentiment_analyses for select to authenticated using (public.hf_is_member(organization_id));
create policy clusters_select on public.conversation_clusters for select to authenticated using (public.hf_is_member(organization_id));
create policy alerts_select on public.alerts for select to authenticated using (public.hf_is_member(organization_id));
create policy incidents_select on public.incidents for select to authenticated using (public.hf_is_member(organization_id));
create policy incident_events_select on public.incident_events for select to authenticated using (public.hf_is_member(organization_id));
create policy daily_reports_select on public.daily_reports for select to authenticated using (public.hf_is_member(organization_id));

-- Revisión humana (E): analyst+ puede confirmar/descartar.
revoke update on public.sentiment_analyses from authenticated;
grant update (review_status, reviewed_by, reviewed_at) on public.sentiment_analyses to authenticated;
create policy sentiment_review on public.sentiment_analyses for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[])
              and reviewed_by = (select auth.uid()));
revoke update on public.alerts from authenticated;
grant update (review_status, reviewed_by, reviewed_at) on public.alerts to authenticated;
create policy alerts_review on public.alerts for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin','analyst']::public.hf_role[])
              and reviewed_by = (select auth.uid()));

-- Incidentes (F): responder+ crea y gestiona.
create policy incidents_insert on public.incidents for insert to authenticated
  with check (public.hf_has_role(organization_id, array['owner','admin','analyst','responder']::public.hf_role[])
              and opened_by = (select auth.uid()) and is_synthetic = false);
revoke update on public.incidents from authenticated;
grant update (status, owner_user_id, resolution_summary, title) on public.incidents to authenticated;
create policy incidents_update on public.incidents for update to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin','analyst','responder']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin','analyst','responder']::public.hf_role[]));
create policy incident_events_note on public.incident_events for insert to authenticated
  with check (kind = 'note'
              and actor_user_id = (select auth.uid())
              and public.hf_has_role(organization_id, array['owner','admin','analyst','responder']::public.hf_role[]));

-- Configuración (owner/admin).
create policy alert_rules_select on public.alert_rules for select to authenticated using (public.hf_is_member(organization_id));
create policy alert_rules_write on public.alert_rules for all to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
-- Teléfonos = PII: solo owner/admin.
create policy wa_recipients_admin on public.whatsapp_recipients for all to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]))
  with check (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
create policy deliveries_select on public.notification_deliveries for select to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
create policy budgets_select on public.usage_budgets for select to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (public.hf_has_role(organization_id, array['owner','admin']::public.hf_role[]));

revoke all on all tables in schema public from anon;
revoke update, delete, truncate on public.incident_events from authenticated, anon;
-- Usuarios nunca borran incidentes, alertas ni análisis: se cierran o descartan.
revoke delete, truncate on public.incidents, public.alerts, public.sentiment_analyses from authenticated;
