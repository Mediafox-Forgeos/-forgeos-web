# 11 — Inventario definitivo del esquema de Hey Foxy (migraciones 0001–0004)

| Propiedad    | Valor                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha        | 2026-11-14                                                                                                                                                  |
| Fuente       | `apps/heyfoxy-web/supabase/migrations/*.sql`, aplicadas en PostgreSQL 17.11 y 16 locales y extraídas del catálogo (`pg_catalog`)                            |
| Contrato     | `apps/heyfoxy-web/tests/sql/20_schema_contract.check.sql` (31 controles; solo lectura). Lo ejecuta `scripts/test-db.sh`                                     |
| Estado en QA | **Aplicado el 2026-11-14** (commit `020e3a7`). Contrato 31/31, huella de privilegios idéntica a la local (`28d1c0af…`), batería remota 111/111 sin residuos |

## 1. Resolución de la discrepancia «28 tablas»

El esquema real tiene **26 tablas**. La cifra 28 del WORKLOG (2026-11-13) y del procedimiento 10 §3 era un error de recuento y nunca correspondió a ninguna migración.

- El modelo **propuesto** en [03 §4](./03_ARCHITECTURE.md) lista 25 filas. Una de ellas, `users`, no es una tabla de `public`: el perfil vive en `auth.users`, que gestiona Supabase.
- Las migraciones crean esas 24 tablas de `public` más dos que aparecieron al implementar: `source_coverage` (requisitos B/C/D) y `usage_budgets` (requisito I).
- 24 + 2 = **26**, con RLS activa en las 26. Comprobado en el catálogo con 0001–0003 y con 0004.

## 2. Totales (catálogo, tras 0001–0004)

| Objeto                         |        0001 | 0002 | 0003 | 0004 | Total |
| ------------------------------ | ----------: | ---: | ---: | ---: | ----: |
| Tablas (todas con RLS)         |           5 |    9 |   12 |    — |    26 |
| Tipos enum                     |           1 |    5 |    4 |    — |    10 |
| Funciones `hf_*`               |           4 |    2 |    3 |    — |     9 |
| — de ellas `SECURITY DEFINER`  |           2 |    2 |    2 |    — |     6 |
| Triggers                       |           2 |   11 |    5 |    — |    18 |
| Índices de clave primaria      |           5 |    9 |   12 |    — |    26 |
| Índices únicos (restricciones) |           3 |    7 |    6 |    — |    16 |
| Índices no únicos              |           3 |    8 |    7 |    — |    18 |
| **Índices totales**            |          11 |   24 |   25 |    — |    60 |
| Políticas RLS                  |          10 |    9 |   18 |    — |    37 |
| Extensiones                    | `pgcrypto`¹ |    — |    — |    — |     — |

¹ `create extension if not exists pgcrypto`: en `heyfoxy-qa` ya está instalada en el esquema `extensions`, así que no hace nada. `gen_random_uuid()` es nativa de PostgreSQL ≥ 13.

**Objeto previo del proyecto (no es de Hey Foxy):** `public.rls_auto_enable()` y el event trigger `ensure_rls`, creados por Supabase al activar «auto-enable RLS». Activan RLS en cada tabla nueva de `public`. Son compatibles con las migraciones (simulados en local con su definición literal) y quedan fuera de los conteos `hf_*`.

## 3. Tablas y mecanismo de autorización

Las 26 tablas **requieren y tienen RLS**. Ninguna usa otro mecanismo _en lugar_ de RLS. Los mecanismos complementarios (grants por operación y columna, triggers, `service_role`) se suman a RLS.

| Clase                                                  | Mecanismo                                                                                              | Tablas                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Lectura por miembros, escritura por rol**         | RLS con `hf_is_member` / `hf_has_role`. Grants solo para las operaciones con política                  | `organizations` (S, U owner/admin) · `brands`, `alert_rules`, `whatsapp_recipients` (S, I/U/D owner/admin; teléfonos solo owner/admin) · `memberships` (S, I/U/D owner/admin; solo un owner crea owners) · `audit_logs` (S owner/admin, I miembro como sí mismo) · `incidents` (S, I responder+, U por columnas) · `incident_events` (S, I solo `note`) · `data_sources`, `sentiment_analyses`, `alerts` (S, U por columnas) |
| **B. Solo lectura para usuarios; escribe el servidor** | RLS de lectura + `service_role` (BYPASSRLS) con S/I/U/D                                                | `social_accounts`, `source_coverage`, `social_posts`, `post_metric_snapshots`, `social_comments`, `social_mentions`, `topics`, `conversation_clusters`, `daily_reports` (miembros) · `ingestion_jobs` (analyst+) · `notification_deliveries`, `usage_budgets`, `ai_usage` (owner/admin)                                                                                                                                      |
| **C. Denegación total a usuarios**                     | RLS sin políticas **y** sin ningún grant a `authenticated`/`anon` (doble barrera); solo `service_role` | `platform_staff`, `integration_credentials`                                                                                                                                                                                                                                                                                                                                                                                  |

**Grants por columna (`authenticated`, UPDATE):**

- `data_sources`: `display_name`, `ingestion_paused`, `max_items_per_day`, `poll_interval_minutes`;
- `sentiment_analyses` y `alerts`: `review_status`, `reviewed_by`, `reviewed_at`;
- `incidents`: `status`, `owner_user_id`, `resolution_summary`, `title`.

**Append-only:** `audit_logs` e `incident_events`. Los protege el trigger `hf_forbid_mutation`, y además ningún rol tiene UPDATE ni DELETE sobre ellas, tampoco `service_role`.

**Sin borrado para usuarios:** `incidents`, `alerts` y `sentiment_analyses` se cierran o se descartan.

## 4. Funciones

Todas tienen `search_path = ''`, así que no se puede secuestrar su `search_path`. El dueño es `postgres`.

| Función                               | Tipo                      | `SECURITY DEFINER` | EXECUTE (tras 0004)             | Uso                                                                                                                         |
| ------------------------------------- | ------------------------- | :----------------: | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hf_is_member(uuid)`                  | `sql stable` → boolean    |         Sí         | `authenticated`, `service_role` | Helper de RLS. DEFINER para leer `memberships` sin recursión de RLS. Solo devuelve un booleano sobre el propio `auth.uid()` |
| `hf_has_role(uuid, hf_role[])`        | `sql stable` → boolean    |         Sí         | `authenticated`, `service_role` | Igual que la anterior, con rol                                                                                              |
| `hf_guard_synthetic()`                | trigger                   |         Sí         | nadie²                          | Los sintéticos solo vienen del proveedor demo, y viceversa                                                                  |
| `hf_guard_same_org_source()`          | trigger                   |         Sí         | nadie²                          | Los hijos de `data_sources` pertenecen a la misma organización (7 tablas)                                                   |
| `hf_incident_guard()`                 | trigger                   |         Sí         | nadie²                          | FSM de incidentes, eventos automáticos y validación del responsable                                                         |
| `hf_guard_incident_event_org()`       | trigger                   |         Sí         | nadie²                          | Un evento pertenece a la organización de su incidente                                                                       |
| `hf_touch_updated_at()`               | trigger                   |         No         | nadie²                          | `updated_at`                                                                                                                |
| `hf_forbid_mutation()`                | trigger                   |         No         | nadie²                          | Append-only                                                                                                                 |
| `hf_incident_transition_allowed(...)` | `sql immutable` → boolean |         No         | nadie²                          | Tabla de transiciones; la invoca `hf_incident_guard` como su dueño                                                          |

² Un trigger se dispara sin comprobar el EXECUTE del rol que modifica la fila. Retirar EXECUTE impide invocar estas funciones por `/rest/v1/rpc` y no afecta a los triggers (comprobado con la batería de 111 pruebas).

## 5. Triggers (18)

| Tabla                                                                                                                                   | Trigger                       | Función                       | Momento              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------- | -------------------- |
| `organizations`                                                                                                                         | `organizations_touch`         | `hf_touch_updated_at`         | BEFORE UPDATE        |
| `audit_logs`                                                                                                                            | `audit_logs_append_only`      | `hf_forbid_mutation`          | BEFORE UPDATE/DELETE |
| `data_sources`                                                                                                                          | `data_sources_touch`          | `hf_touch_updated_at`         | BEFORE UPDATE        |
| `social_accounts`, `source_coverage`, `integration_credentials`, `social_posts`, `social_comments`, `social_mentions`, `ingestion_jobs` | `<tabla>_same_org` (7)        | `hf_guard_same_org_source`    | BEFORE INSERT/UPDATE |
| `social_posts`, `social_comments`, `social_mentions`                                                                                    | `<tabla>_synthetic` (3)       | `hf_guard_synthetic`          | BEFORE INSERT/UPDATE |
| `incidents`                                                                                                                             | `incidents_touch`             | `hf_touch_updated_at`         | BEFORE UPDATE        |
| `incidents`                                                                                                                             | `incidents_guard_insert`      | `hf_incident_guard`           | AFTER INSERT         |
| `incidents`                                                                                                                             | `incidents_guard_update`      | `hf_incident_guard`           | BEFORE UPDATE        |
| `incident_events`                                                                                                                       | `incident_events_append_only` | `hf_forbid_mutation`          | BEFORE UPDATE/DELETE |
| `incident_events`                                                                                                                       | `incident_events_same_org`    | `hf_guard_incident_event_org` | BEFORE INSERT        |

## 6. Índices no únicos (18)

| Migración | Índices                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001      | `brands_org_idx`, `memberships_user_idx`, `audit_logs_org_idx`                                                                                                                                                                       |
| 0002      | `social_accounts_org_idx`, `source_coverage_org_idx`, `social_posts_org_idx`, `post_metric_snapshots_post_idx`, `social_comments_org_time_idx`, `social_comments_hash_idx`, `social_mentions_org_time_idx`, `ingestion_jobs_org_idx` |
| 0003      | `sentiment_analyses_org_idx`, `sentiment_analyses_review_idx` (parcial, `pending`), `sentiment_analyses_hash_idx`, `alerts_org_idx`, `incidents_org_idx`, `incident_events_incident_idx`, `ai_usage_org_month_idx`                   |

**Índices únicos (16):**

- `organizations(slug)`, `brands(org,name)` y `memberships(org,user)`;
- `data_sources(org,provider)`, `social_accounts(org,platform,external_id)`, `integration_credentials(data_source,key_version)`, `social_posts`, `social_comments` y `social_mentions` (`org,data_source,external_id`), `ingestion_jobs(org,idempotency_key)`;
- `topics(org,label)`, `sentiment_analyses(org,item_type,item_id,prompt_version,model)`, `alerts(org,dedupe_key)`, `whatsapp_recipients(org,phone)`, `notification_deliveries(org,idempotency_key)` y `daily_reports(org,report_date)`.

**FK sin índice de cobertura: 27.** El linter de rendimiento de Supabase las reportará como INFO. A volumen de QA no tienen impacto; quedan en HF-PERF-01.

## 7. Políticas RLS (37, todas `to authenticated`)

| Tabla                                                                                                                                 | Políticas                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `organizations`                                                                                                                       | `organizations_select` (S), `organizations_update` (U)                 |
| `brands`                                                                                                                              | `brands_select` (S), `brands_write` (ALL)                              |
| `memberships`                                                                                                                         | `memberships_select`, `_insert`, `_update`, `_delete`                  |
| `audit_logs`                                                                                                                          | `audit_logs_select` (S), `audit_logs_insert` (I)                       |
| `data_sources`                                                                                                                        | `data_sources_select` (S), `data_sources_update` (U)                   |
| `social_accounts`, `source_coverage`, `social_posts`, `post_metric_snapshots`, `social_comments`, `social_mentions`, `ingestion_jobs` | `<tabla>_select` (7)                                                   |
| `topics`, `conversation_clusters`, `daily_reports`                                                                                    | `topics_select`, `clusters_select`, `daily_reports_select`             |
| `sentiment_analyses`                                                                                                                  | `sentiment_select` (S), `sentiment_review` (U)                         |
| `alerts`                                                                                                                              | `alerts_select` (S), `alerts_review` (U)                               |
| `incidents`                                                                                                                           | `incidents_select` (S), `incidents_insert` (I), `incidents_update` (U) |
| `incident_events`                                                                                                                     | `incident_events_select` (S), `incident_events_note` (I)               |
| `alert_rules`                                                                                                                         | `alert_rules_select` (S), `alert_rules_write` (ALL)                    |
| `whatsapp_recipients`                                                                                                                 | `wa_recipients_admin` (ALL)                                            |
| `notification_deliveries`, `usage_budgets`, `ai_usage`                                                                                | `deliveries_select`, `budgets_select`, `ai_usage_select`               |
| `platform_staff`, `integration_credentials`                                                                                           | ninguna (denegación total)                                             |

## 8. Por qué existe la migración 0004

Lectura de `pg_default_acl` en `heyfoxy-qa` (2026-11-14, solo lectura). Cuando el rol creador es `postgres`, el mismo que usa el MCP:

- una tabla nueva concede a `anon`, `authenticated` y `service_role` **solo** `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN`, sin SELECT, INSERT, UPDATE ni DELETE;
- las funciones y secuencias nuevas no conceden nada, ni siquiera a `PUBLIC`.

Las migraciones 0001–0003 se escribieron para el modelo antiguo («ALL por defecto, después revocar»).

**Reproducido en local con los privilegios reales.** Las tres migraciones aplican sin error, pero la batería se detiene en la prueba 26 de 111 con `permission denied for table brands`. En QA, la aplicación y el servidor se habrían quedado sin acceso, y además `authenticated` habría conservado TRUNCATE en 20 tablas.

**Lo que hace 0004:**

- revoca **todo** sobre las 26 tablas a `public`, `anon`, `authenticated` y `service_role`, y concede solo lo que necesita cada política;
- `service_role` recibe S/I/U/D, sin TRUNCATE y sin mutar las tablas append-only;
- fija explícitamente el EXECUTE de las funciones.

El resultado no depende del rol creador ni de los privilegios por defecto: el contrato de 31 controles y la batería de 111 pruebas dan el mismo resultado con el modelo real y con el antiguo, en PG17 y en PG16.

## 9. Migración 0005 (preparada; se aplica con el GO de Gate B)

`20261114000500_hf_sec_fixes_member_names.sql` es aditiva. Tras aplicarla, el contrato pasa a 36 controles y la batería a 122 pruebas.

| Cambio               | Detalle                                                                                                                                                                                                                                                                                                                   | Totales tras 0005                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **HF-SEC-03**        | Función `hf_guard_incident_refs()` (SECURITY DEFINER, `search_path=''`, sin EXECUTE para usuarios) y trigger `incidents_refs_guard` (BEFORE INSERT OR UPDATE OF `alert_id`). `alert_id` debe ser de la misma organización, también para el servidor. En el alta, `owner_user_id` debe ser un miembro con rol de respuesta | 10 funciones `hf_*` (7 DEFINER), 19 triggers |
| **HF-SEC-04**        | `authenticated` pasa de UPDATE sobre toda la tabla `organizations` a UPDATE solo en (`name`, `timezone`). `plan`, `is_demo`, `slug` y `retention_days` quedan reservados a la plataforma                                                                                                                                  | —                                            |
| **Nombres visibles** | `memberships.display_name` (texto opcional, 1–120). Lo gestionan owner/admin con las políticas existentes; la UI lo usa para asignar incidentes                                                                                                                                                                           | —                                            |

- Sin cambios en tablas (26), políticas (37), enums (10) ni índices (60).
- Nuevo control permanente del contrato: las guardas append-only deben estar habilitadas (`tgenabled = O`).
- **Pruebas negativas:** sin 0005, la batería falla en `HF-SEC-04: owner no puede cambiar plan`.
- **Rollback probado:** vuelve exactamente al estado de 0004.

## 10. Hallazgos pendientes (en TECH_BACKLOG)

- **HF-SEC-06.** Las FK hacia entidades del mismo tenant en `alerts.alert_rule_id/analysis_id/cluster_id`, `notification_deliveries.*` y `post_metric_snapshots.post_id` no tienen guarda de misma organización. Solo las escribe `service_role`, así que el riesgo es bajo.
- **HF-PERF-01.** 27 FK sin índice y políticas permisivas duplicadas (`brands`, `alert_rules`), que el linter marca como WARN de rendimiento.
