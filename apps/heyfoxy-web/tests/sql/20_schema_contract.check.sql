-- Hey Foxy — contrato de esquema tras 0001–0004. SOLO LECTURA (un único SELECT).
-- Uso local: lo ejecuta el arnés tras migrar. Uso remoto: execute_sql en heyfoxy-qa.
-- Aceptación: todas las filas con ok = true. Fuente de los valores: docs/product/heyfoxy/11_SCHEMA_INVENTORY.md
with
hf_tables as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
hf_funcs as (
  select p.oid, p.proname, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'hf\_%'
),
tgrants as (
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
),
auth_grants as (
  select table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
  from tgrants where grantee = 'authenticated' group by table_name
),
col_upd as (
  select table_name, string_agg(column_name, ',' order by column_name) as cols
  from information_schema.column_privileges
  where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'UPDATE'
    and table_name in ('data_sources', 'sentiment_analyses', 'alerts', 'incidents')
  group by table_name
),
checks(check_name, expected, actual) as (
  values
  ('tables_public',                '26', (select count(*)::text from hf_tables)),
  ('tables_with_rls',              '26', (select count(*)::text from hf_tables where relrowsecurity)),
  ('policies_public',              '37', (select count(*)::text from pg_policies where schemaname = 'public')),
  ('tables_without_policies',      'integration_credentials,platform_staff',
     (select string_agg(relname, ',' order by relname) from hf_tables t
      where not exists (select 1 from pg_policy p where p.polrelid = t.oid))),
  ('enums_public',                 '10', (select count(*)::text from pg_type t join pg_namespace n on n.oid = t.typnamespace
                                          where n.nspname = 'public' and t.typtype = 'e')),
  ('hf_functions',                 '9',  (select count(*)::text from hf_funcs)),
  ('hf_security_definer',          'hf_guard_incident_event_org,hf_guard_same_org_source,hf_guard_synthetic,hf_has_role,hf_incident_guard,hf_is_member',
     (select string_agg(proname, ',' order by proname) from hf_funcs where prosecdef)),
  ('hf_functions_without_empty_search_path', '0',
     (select count(*)::text from hf_funcs where proconfig is null or not ('search_path=""' = any (proconfig)))),
  ('triggers_public',              '18', (select count(*)::text from pg_trigger tg join hf_tables t on t.oid = tg.tgrelid where not tg.tgisinternal)),
  ('indexes_public_total',         '60', (select count(*)::text from pg_indexes where schemaname = 'public')),
  ('indexes_non_unique',           '18', (select count(*)::text from pg_index i join hf_tables t on t.oid = i.indrelid where not i.indisunique)),
  ('anon_table_grants',            '0',  (select count(*)::text from tgrants where grantee in ('anon', 'PUBLIC'))),
  ('authenticated_truncate_refs_trigger', '0',
     (select count(*)::text from tgrants where grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'))),
  ('authenticated_tables_with_any_grant', '24', (select count(*)::text from auth_grants)),
  ('authenticated_on_integration_credentials', '', coalesce((select privs from auth_grants where table_name = 'integration_credentials'), '')),
  ('authenticated_on_platform_staff', '', coalesce((select privs from auth_grants where table_name = 'platform_staff'), '')),
  ('authenticated_on_audit_logs',  'INSERT,SELECT', (select privs from auth_grants where table_name = 'audit_logs')),
  ('authenticated_on_incident_events', 'INSERT,SELECT', (select privs from auth_grants where table_name = 'incident_events')),
  ('authenticated_on_incidents',   'INSERT,SELECT', (select privs from auth_grants where table_name = 'incidents')),
  ('authenticated_on_alerts',      'SELECT', (select privs from auth_grants where table_name = 'alerts')),
  ('authenticated_on_social_comments', 'SELECT', (select privs from auth_grants where table_name = 'social_comments')),
  ('authenticated_on_whatsapp_recipients', 'DELETE,INSERT,SELECT,UPDATE', (select privs from auth_grants where table_name = 'whatsapp_recipients')),
  ('authenticated_col_update_data_sources', 'display_name,ingestion_paused,max_items_per_day,poll_interval_minutes',
     (select cols from col_upd where table_name = 'data_sources')),
  ('authenticated_col_update_sentiment_analyses', 'review_status,reviewed_at,reviewed_by', (select cols from col_upd where table_name = 'sentiment_analyses')),
  ('authenticated_col_update_alerts', 'review_status,reviewed_at,reviewed_by', (select cols from col_upd where table_name = 'alerts')),
  ('authenticated_col_update_incidents', 'owner_user_id,resolution_summary,status,title', (select cols from col_upd where table_name = 'incidents')),
  ('service_role_tables_with_crud', '26',
     (select count(*)::text from (select table_name from tgrants where grantee = 'service_role'
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') group by table_name
        having count(distinct privilege_type) >= 2) s)),
  ('service_role_truncate',        '0', (select count(*)::text from tgrants where grantee = 'service_role' and privilege_type = 'TRUNCATE')),
  ('service_role_mutates_append_only', '0',
     (select count(*)::text from tgrants where grantee = 'service_role' and table_name in ('audit_logs', 'incident_events')
        and privilege_type in ('UPDATE', 'DELETE'))),
  ('anon_execute_hf_functions',    '0', (select count(*)::text from hf_funcs where has_function_privilege('anon', oid, 'EXECUTE'))),
  ('authenticated_execute_hf_functions', 'hf_has_role,hf_is_member',
     (select string_agg(proname, ',' order by proname) from hf_funcs where has_function_privilege('authenticated', oid, 'EXECUTE')))
)
select check_name, expected, coalesce(actual, '<null>') as actual, coalesce(actual, '<null>') = expected as ok
from checks
order by ok, check_name;
