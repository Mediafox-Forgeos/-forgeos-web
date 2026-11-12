# Hey Foxy — 03 · Arquitectura multiempresa (Fase 2)

| Propiedad  | Valor                  |
| ---------- | ---------------------- |
| Work order | WO-MFOX-HEYFOXY-001    |
| Estado     | Gate 1 — PROPUESTA     |
| Criterios  | AC01, AC03, AC10, AC11 |

## 1. Principios

1. **Producto independiente**: base, Auth, despliegue, secretos y marca propios. Funciona sin MediaFOX OS.
2. **El inquilino es la organización**: cada fila de negocio lleva `organization_id` y RLS lo hace cumplir. La interfaz nunca es la frontera de seguridad.
3. **Ruta crítica en código propio** (ingesta → IA → alerta → WhatsApp). n8n solo para automatizaciones opcionales.
4. **Ingesta idempotente y reanudable**: reprocesar nunca duplica ni re-alerta.
5. **Conformidad con las fuentes**: solo APIs oficiales o proveedores licenciados; se honra la eliminación de contenido.
6. **Costo controlado por diseño**: presupuestos por organización, deduplicación antes de IA, modelos pequeños por defecto.

## 2. Vista de componentes

```
                ┌────────────── Hey Foxy (Vercel: heyfoxy-web, Next.js) ──────────────┐
 Usuarios ───►  │  Command Center (UI)   ·   API /api/v1 (integraciones)   ·   Webhooks │
                │                          │                                 │ Meta/WA  │
                │   Scheduler (Vercel Cron, firmado)  ──►  Job runner (rutas server)    │
                └───────┬───────────────────────┬──────────────────────┬───────────────┘
                        │                       │                      │
              ┌─────────▼────────┐   ┌──────────▼─────────┐  ┌─────────▼──────────┐
              │ Conectores       │   │ Motor IA (Model    │  │ Notificaciones     │
              │ metricool        │   │ Router: tarea →    │  │ WhatsApp Cloud API │
              │ meta_graph       │   │ proveedor+modelo)  │  │ email · in-app     │
              │ youtube · (x)    │   └──────────┬─────────┘  └─────────┬──────────┘
              └─────────┬────────┘              │                      │
                        └──────────► Supabase (proyecto propio: Postgres + RLS + Auth) ◄──┘
                                       jobs · datos sociales · análisis · alertas · auditoría
                        n8n (opcional, fuera de la ruta crítica) ◄─ eventos firmados
                        MediaFOX OS ◄──── API firmada y versionada ────► Hey Foxy
```

### Decisiones de arquitectura propuestas (requieren aprobación)

| #   | Decisión      | Recomendación                                                                                                                                                             | Alternativa                                                                    |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D1  | Repositorio   | `apps/heyfoxy-web` dentro del monorepo **Mediafox-ForgeOS** (producto de MediaFOX Forge; reutiliza `typescript-config`, `eslint-config`, `ui`) con su carpeta `supabase/` | Repositorio propio `heyfoxy`                                                   |
| D2  | Base de datos | **Proyecto Supabase nuevo** (`heyfoxy-qa` y luego `heyfoxy-prod`, sa-east-1). Nunca la base de MediaFOX OS                                                                | Esquema separado en otra base: descartado por aislamiento y costo de auditoría |
| D3  | Jobs          | Cola en Postgres (`ingestion_jobs` con _lease_ y reintentos) disparada por Vercel Cron cada 5–15 min; webhooks Meta encolan en la misma tabla                             | Vercel Queues (beta) o n8n: se evaluarán con volumen real                      |
| D4  | IA            | _Model Router_ portado de MediaFOX OS; proveedor por variable de entorno (OpenAI directo o Vercel AI Gateway; Anthropic como alternativa)                                 | Proveedor fijo                                                                 |
| D5  | WhatsApp      | **WhatsApp Cloud API de Meta directo** (sin intermediario, menor costo)                                                                                                   | BSP (Twilio u otro) si se necesita soporte o un número rápido                  |

## 3. Flujo de datos (MVP)

1. **Scheduler** crea `ingestion_jobs` por `data_source` activo (ventana `since` = último cursor).
2. **Conector** lee la fuente, normaliza a `social_posts` / `social_comments` / `social_mentions` y hace _upsert_ por clave natural → idempotente.
3. Los elementos nuevos o editados (`content_hash` distinto) entran a **`analysis_queue`**.
4. **Motor IA** clasifica por lotes, escribe `sentiment_analyses` (con modelo, versión de prompt, confianza y justificación).
5. **Evaluador de reglas** calcula señales (volumen, anomalía, severidad, recurrencia) contra `alert_rules` → crea `alerts` (dedupe por regla + ventana) y, si corresponde, abre o actualiza un `incident`.
6. **Notificador** genera `notification_deliveries` (WhatsApp / email / in-app) respetando horarios, umbrales y consentimiento.
7. **Resumen diario** consolida y envía `daily_reports`.

## 4. Modelo de datos (propuesto)

Convenciones: `id uuid`, `organization_id uuid not null` en toda tabla de negocio, `created_at`/`updated_at`, borrado lógico solo donde se indica. Nombres ajustados respecto de la WO donde aporta claridad.

| Tabla                             | Propósito                                                            | Claves e índices relevantes                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`                   | Inquilino (empresa cliente)                                          | `slug` único, `plan`, `status`, `settings jsonb` (zona horaria, idioma)                                                                                                                                          |
| `brands` _(nueva)_                | Marcas dentro de una organización (MedPlus puede tener varias)       | `(organization_id, slug)` único                                                                                                                                                                                  |
| `users`                           | Perfil enlazado a `auth.users`                                       | `id = auth.uid()`                                                                                                                                                                                                |
| `memberships`                     | Usuario ↔ organización ↔ rol                                         | `(organization_id, user_id)` único; rol ∈ `owner, admin, analyst, responder, viewer`                                                                                                                             |
| `platform_staff` _(nueva)_        | Soporte de la plataforma (MediaFOX) con acceso auditado              | Acceso explícito, nunca implícito                                                                                                                                                                                |
| `data_sources`                    | Una fuente conectada: (marca, plataforma, cuenta, conector)          | `connector ∈ metricool, meta_graph, youtube, x, demo`; `status`, `cursor jsonb`, `last_success_at`, `error_count`                                                                                                |
| `social_accounts`                 | Cuenta/perfil observado (propio o público)                           | `(organization_id, platform, external_id)` único; `ownership ∈ owned, public`                                                                                                                                    |
| `integration_credentials`         | Tokens cifrados por fuente                                           | Solo `service_role`; ver §6                                                                                                                                                                                      |
| `social_posts`                    | Publicación normalizada                                              | `(organization_id, platform, external_id)` único; `campaign_id` opcional, `metrics jsonb`, `metrics_history` en `post_metric_snapshots`                                                                          |
| `post_metric_snapshots` _(nueva)_ | Serie temporal de métricas (para anomalías)                          | `(post_id, captured_at)`                                                                                                                                                                                         |
| `social_comments`                 | Comentario o respuesta                                               | `(organization_id, platform, external_id)` único; `post_id`, `parent_id`, `author_ref` (hash), `text`, `content_hash`, `deleted_at_source`                                                                       |
| `social_mentions`                 | Mención de la marca fuera de sus publicaciones                       | Igual que comentarios                                                                                                                                                                                            |
| `sentiment_analyses`              | Resultado IA por elemento                                            | `(subject_type, subject_id, analysis_version)` único; `sentiment`, `intent`, `topics[]`, `priority`, `confidence`, `rationale`, `model`, `prompt_version`, `needs_human_review`, `reviewed_by`, `review_verdict` |
| `topics`                          | Temas recurrentes por marca                                          | `(organization_id, brand_id, key)` único; `label`, `first_seen`, `last_seen`                                                                                                                                     |
| `conversation_clusters` _(nueva)_ | Agrupación de conversaciones relacionadas                            | Miembros en `cluster_members`                                                                                                                                                                                    |
| `alert_rules`                     | Umbrales y condiciones por marca                                     | `type`, `params jsonb`, `cooldown_minutes`, `min_confidence`, `active`                                                                                                                                           |
| `alerts`                          | Alerta concreta                                                      | `dedupe_key` único por `(organization_id, dedupe_key)`; `severity`, `evidence jsonb`, `incident_id`                                                                                                              |
| `incidents`                       | Caso con estado y responsable                                        | Estado FSM `open → acknowledged → in_progress → escalated → resolved → closed`; `assignee_id`, `severity`, `sla_due_at`                                                                                          |
| `incident_events`                 | Historial append-only del incidente                                  | Sin UPDATE/DELETE por RLS                                                                                                                                                                                        |
| `whatsapp_recipients`             | Destinatario autorizado                                              | `phone_e164`, `consent_at`, `consent_source`, `opt_out_at`, `quiet_hours`, `preferences jsonb`                                                                                                                   |
| `notification_deliveries`         | Cada envío (WA/email/in-app)                                         | `idempotency_key` único; `provider_message_id`, `status` (queued/sent/delivered/read/failed), `cost_estimate`, `attempts`                                                                                        |
| `daily_reports`                   | Resumen generado                                                     | `(organization_id, brand_id, report_date)` único; `content jsonb`, `sent_at`                                                                                                                                     |
| `ingestion_jobs`                  | Cola de trabajo                                                      | `status`, `run_after`, `lease_until`, `attempts`, `last_error`; `(data_source_id, window_start)` único                                                                                                           |
| `ai_usage` _(nueva)_              | Medición de tokens y costo por organización                          | Base de presupuestos y facturación                                                                                                                                                                               |
| `audit_logs`                      | Quién hizo qué (configuración, accesos, exportaciones, credenciales) | Append-only                                                                                                                                                                                                      |

## 5. Roles y permisos

| Capacidad                                         | owner | admin | analyst | responder | viewer |
| ------------------------------------------------- | ----- | ----- | ------- | --------- | ------ |
| Ver dashboard y reportes                          | ✓     | ✓     | ✓       | ✓         | ✓      |
| Revisar/corregir clasificación IA                 | ✓     | ✓     | ✓       | —         | —      |
| Gestionar incidentes asignados                    | ✓     | ✓     | ✓       | ✓         | —      |
| Configurar reglas, horarios, destinatarios        | ✓     | ✓     | —       | —         | —      |
| Conectar fuentes / credenciales                   | ✓     | ✓     | —       | —         | —      |
| Usuarios, plan, facturación, eliminación de datos | ✓     | —     | —       | —         | —      |

Como en MediaFOX OS: matriz central en código para la interfaz + **RLS como autoridad** (`is_org_member(org)`, `has_org_role(org, roles[])`, funciones `SECURITY DEFINER` con `search_path` fijo y `GRANT` mínimos).

## 6. Seguridad y aislamiento (AC11)

- **RLS en todas las tablas**; pruebas de aislamiento automáticas (usuario de la organización A no lee nada de B, incluido por API REST directa).
- **Credenciales**: cifradas en aplicación con AES-256-GCM (cifrado de sobre); clave maestra solo en variables cifradas de Vercel, rotable; la tabla `integration_credentials` no tiene políticas para `authenticated`. Alternativa evaluada: Supabase Vault. Los tokens nunca llegan al navegador ni a los logs.
- **Webhooks entrantes** (Meta, WhatsApp): verificación de firma `X-Hub-Signature-256` y _verify token_; rechazo sin firma válida.
- **Datos personales**: minimización — `author_ref` es un hash del ID del autor por organización; el nombre visible solo se guarda si la fuente lo entrega y el plan lo requiere. Teléfonos de destinatarios cifrados en reposo.
- **Retención**: por plan (ej. 90/365/730 días). Job diario purga texto de comentarios vencidos y conserva agregados anónimos. Eliminación de organización: borrado completo en ≤ 30 días con registro en `audit_logs`.
- **Eliminación en la fuente**: si la plataforma informa que un contenido se borró (webhook o sondeo), se marca `deleted_at_source` y se purga el texto (requisito de las plataformas).
- **Auditoría**: cambios de configuración, accesos de `platform_staff`, exportaciones, conexión y desconexión de fuentes.
- **Observabilidad**: `ingestion_jobs` y `notification_deliveries` con estado y errores; panel de salud por fuente; alerta interna si una fuente falla N veces seguidas o deja de producir datos.
- **Reintentos**: backoff exponencial con tope; errores 4xx de permisos desactivan la fuente y avisan al admin (no reintentar a ciegas).
- **Protección contra duplicados**: claves naturales únicas en ingesta; `dedupe_key` en alertas; `idempotency_key` en envíos.

## 7. Control de costos

- Deduplicar por `content_hash` antes de IA; no re-analizar si el texto no cambió.
- Modelo pequeño para clasificación por lotes; modelo mayor solo para resúmenes y casos críticos.
- Presupuesto mensual de IA y de WhatsApp por organización (`ai_usage`, `notification_deliveries.cost_estimate`) con corte suave (degrada a "solo críticos") y aviso al admin.
- Frecuencia de sondeo por plan.

## 8. Integración con MediaFOX OS (AC10)

| Dirección              | Caso                                                                                           | Mecanismo                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hey Foxy → MediaFOX OS | "Convertir incidente u oportunidad en solicitud creativa" (ej. respuesta gráfica a una crisis) | `POST` a un endpoint nuevo de MediaFOX OS (fase 2), firmado con HMAC y clave por cliente; idempotente; MediaFOX OS crea el borrador por su flujo normal (Foxy Intake) |
| MediaFOX OS → Hey Foxy | Correlacionar publicaciones con campañas y piezas (Cronopost)                                  | API `GET /api/v1/...` de Hey Foxy o webhook saliente desde MediaFOX OS                                                                                                |
| Identidad              | Usuarios de MediaFOX entran a Hey Foxy                                                         | Fase 2: SSO (OIDC). MVP: cuentas propias de Hey Foxy                                                                                                                  |

**Ninguna de estas integraciones forma parte del MVP de 14 días ni modifica MediaFOX OS en esta WO.** Requieren su propia WO y GO.

## 9. Entornos

| Entorno    | Supabase       | Vercel                            | Datos                         |
| ---------- | -------------- | --------------------------------- | ----------------------------- |
| QA         | `heyfoxy-qa`   | Preview `heyfoxy-qa`              | Solo demo y cuentas de prueba |
| Production | `heyfoxy-prod` | `heyfoxy-web` (dominio a definir) | Clientes autorizados          |

Se crean recién después de aprobar Gate 1.
