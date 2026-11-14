-- Hey Foxy — 0004 modelo de privilegios explícito y determinista
--
-- Motivo (verificado en heyfoxy-qa el 2026-11-14, solo lectura): los privilegios por
-- defecto de Supabase dependen del rol creador y de la antigüedad del proyecto. En
-- heyfoxy-qa, una tabla creada por `postgres` solo concede TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN a anon/authenticated/service_role, y una función no concede EXECUTE a nadie.
-- Las migraciones 0001–0003 asumían el modelo antiguo (ALL por defecto) y revocaban
-- sobre él; con el modelo actual, authenticated y service_role se quedaban sin acceso.
--
-- Regla: primero se revoca TODO y después se concede exactamente lo que cada política
-- RLS necesita (grant ⇔ existe política para esa operación). RLS sigue siendo la
-- barrera de filas; los grants son la barrera de operaciones. El resultado es el mismo
-- sea cual sea el rol creador o los privilegios por defecto del proyecto.

-- 1. Tablas: revocación total --------------------------------------------------
revoke all on table
  public.organizations, public.brands, public.memberships, public.platform_staff, public.audit_logs,
  public.data_sources, public.social_accounts, public.source_coverage, public.integration_credentials,
  public.social_posts, public.post_metric_snapshots, public.social_comments, public.social_mentions,
  public.ingestion_jobs,
  public.topics, public.sentiment_analyses, public.conversation_clusters, public.alert_rules, public.alerts,
  public.incidents, public.incident_events, public.whatsapp_recipients, public.notification_deliveries,
  public.daily_reports, public.usage_budgets, public.ai_usage
from public, anon, authenticated, service_role;
-- REVOKE sobre la tabla también retira los grants por columna de 0002/0003; se
-- vuelven a conceder abajo.

-- 2. service_role (servidor: ingesta, IA, notificaciones, backoffice) ---------
-- Sin TRUNCATE: ni siquiera el servidor vacía tablas de negocio.
grant select, insert, update, delete on table
  public.organizations, public.brands, public.memberships, public.platform_staff, public.audit_logs,
  public.data_sources, public.social_accounts, public.source_coverage, public.integration_credentials,
  public.social_posts, public.post_metric_snapshots, public.social_comments, public.social_mentions,
  public.ingestion_jobs,
  public.topics, public.sentiment_analyses, public.conversation_clusters, public.alert_rules, public.alerts,
  public.incidents, public.incident_events, public.whatsapp_recipients, public.notification_deliveries,
  public.daily_reports, public.usage_budgets, public.ai_usage
to service_role;
-- Append-only también para el servidor (defensa en profundidad; los triggers ya lo impiden).
revoke update, delete on public.audit_logs, public.incident_events from service_role;

-- 3. authenticated: lectura (24 tablas; platform_staff e integration_credentials quedan sin nada)
grant select on table
  public.organizations, public.brands, public.memberships, public.audit_logs,
  public.data_sources, public.social_accounts, public.source_coverage,
  public.social_posts, public.post_metric_snapshots, public.social_comments, public.social_mentions,
  public.ingestion_jobs,
  public.topics, public.sentiment_analyses, public.conversation_clusters, public.alert_rules, public.alerts,
  public.incidents, public.incident_events, public.whatsapp_recipients, public.notification_deliveries,
  public.daily_reports, public.usage_budgets, public.ai_usage
to authenticated;

-- 4. authenticated: escritura, solo donde hay política ---------------------------
-- Configuración por owner/admin (políticas *_write / memberships_* / wa_recipients_admin).
grant insert, update, delete on table
  public.brands, public.memberships, public.alert_rules, public.whatsapp_recipients
to authenticated;
-- organizations_update (owner/admin).
grant update on table public.organizations to authenticated;
-- Auditoría y notas de incidente: solo INSERT (append-only).
grant insert on table public.audit_logs, public.incident_events to authenticated;
-- incidents_insert (responder+); sin DELETE: los incidentes se cierran.
grant insert on table public.incidents to authenticated;
-- Grants por columna (mismos que 0002/0003).
grant update (display_name, ingestion_paused, max_items_per_day, poll_interval_minutes)
  on public.data_sources to authenticated;
grant update (review_status, reviewed_by, reviewed_at) on public.sentiment_analyses to authenticated;
grant update (review_status, reviewed_by, reviewed_at) on public.alerts to authenticated;
grant update (status, owner_user_id, resolution_summary, title) on public.incidents to authenticated;

-- 5. Funciones ---------------------------------------------------------------------
-- Helpers de RLS: solo authenticated (las políticas son `to authenticated`) y service_role.
revoke all on function public.hf_is_member(uuid), public.hf_has_role(uuid, public.hf_role[])
  from public, anon;
grant execute on function public.hf_is_member(uuid), public.hf_has_role(uuid, public.hf_role[])
  to authenticated, service_role;
-- Funciones de trigger y la FSM: no son invocables por API. Los triggers se disparan
-- sin comprobar EXECUTE del rol que modifica la fila.
revoke all on function
  public.hf_touch_updated_at(), public.hf_forbid_mutation(), public.hf_guard_synthetic(),
  public.hf_guard_same_org_source(), public.hf_incident_guard(), public.hf_guard_incident_event_org(),
  public.hf_incident_transition_allowed(public.hf_incident_status, public.hf_incident_status)
from public, anon, authenticated;
