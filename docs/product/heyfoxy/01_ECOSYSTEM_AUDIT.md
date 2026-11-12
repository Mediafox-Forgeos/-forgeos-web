# Hey Foxy — 01 · Auditoría del ecosistema (Fase 0)

| Propiedad  | Valor                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Work order | WO-MFOX-HEYFOXY-001                                                             |
| Estado     | Gate 1 — PROPUESTA (sin infraestructura, sin migraciones, sin código funcional) |
| Fecha      | 2026-11-12                                                                      |
| Autor      | VULCAN                                                                          |

Inspección de solo lectura. No se copiaron secretos: solo se listan **nombres** de variables, nunca valores.

## 1. MediaFOX OS (repositorio `mediafox-os`)

| Aspecto     | Estado observado                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Stack       | Next.js 16 (App Router), React 19, Tailwind v4, Supabase (Postgres 17, RLS), Vercel (`gru1`), Cloudflare R2, Resend           |
| Supabase    | Production `srsllmqeljhodttqefih` y QA `wzamylhiqvosbrlhzssp` (sa-east-1). 3 proyectos más inactivos en la misma organización |
| Vercel      | Equipo `mediafox`: `mediafox-os`, `movos-web`, `forge-labs`, `forgeos-web`. Despliegue por CLI, sin auto-deploy por Git       |
| Migraciones | 116 archivos SQL; RLS en todas las tablas de negocio                                                                          |
| Cron        | Vercel Cron con `CRON_SECRET` (`/api/cron/storage-cleanup`, `/api/cron/floxy-lifecycle`)                                      |

### 1.1 Componentes y su reutilización

| Componente                           | Dónde vive                                                                                                                                                                                              | ¿Reutilizable en Hey Foxy?  | Cómo                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticación                        | Supabase Auth + `src/lib/auth/session.ts`, `proxy.ts`                                                                                                                                                   | **Patrón sí, instancia no** | Hey Foxy usa su propio proyecto Supabase Auth; se replica el patrón de sesión SSR                                                                                                     |
| Usuarios / organizaciones / permisos | `src/lib/tenancy/*` (roles de agencia `super_admin…reviewer` + roles de cliente `client_admin…viewer`), helpers RLS `accessible_client_ids()`, `is_mediafox_staff()`                                    | **Patrón sí, modelo no**    | MediaFOX OS es un modelo _agencia → clientes_; Hey Foxy necesita SaaS multiempresa real (cada organización es inquilino). Se replica: matriz de permisos central + RLS como autoridad |
| Command Center                       | Command Center V1.3 (estado inline, planner)                                                                                                                                                            | **Solo lenguaje visual**    | El dominio (solicitudes/piezas) no aplica; se reutiliza sistema de diseño y patrones de tablas/filtros                                                                                |
| Notificaciones                       | `src/lib/notifications/*`: catálogo de tipos, dedupe, canales `in_app` + `email` (Resend), `sla-check.ts`                                                                                               | **Patrón sí**               | Mismo diseño: catálogo tipado + router por canal + dedupe. WhatsApp **no existe** hoy (comentado explícitamente como "no activado" en `types.ts` y `foxy-connect-contracts.ts`)       |
| Servicios de IA                      | `src/lib/foxy/model-router.ts` (tarea → proveedor + modelo, por variables de entorno), adaptadores `openai-adapter` y `gateway-adapter` (Vercel AI Gateway, cableado pero inactivo), `observability.ts` | **Patrón sí (alto valor)**  | Se porta el _Model Router_ con tareas nuevas (`classify_comment`, `cluster_topics`, `daily_summary`…). Proveedor configurable por variable, igual que `FOXY_MODEL_PROVIDER`           |
| Integraciones WhatsApp               | **No existen** (solo enlaces "compartir por WhatsApp" en Cronopost y formato de teléfono `src/lib/phone/*`)                                                                                             | Formato E.164 sí            | Todo el módulo WhatsApp es nuevo                                                                                                                                                      |
| Idempotencia                         | `src/lib/idempotency-key.ts` (clave por intención, sobrevive reset de formularios React 19)                                                                                                             | **Sí**                      | Mismo principio aplicado a ingesta y a envíos                                                                                                                                         |
| Línea de tiempo / auditoría          | `activity_timeline` + predicados de visibilidad (0115)                                                                                                                                                  | **Patrón sí**               | `incident_events` y `audit_logs` append-only                                                                                                                                          |
| Almacenamiento                       | R2 (`STORAGE_WRITE_PROVIDER`)                                                                                                                                                                           | Opcional                    | Hey Foxy casi no almacena binarios (solo enlaces y miniaturas)                                                                                                                        |

### 1.2 Variables de entorno existentes (solo nombres)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOXY_MODEL_PROVIDER`, `FOXY_MODEL_ID`, `RESEND_API_KEY`, `RESEND_FROM_SENDER`, `R2_*`, `CRON_SECRET`, `TRANSCRIPTION_PROVIDER`. No existen variables de Meta, WhatsApp, Twilio, Metricool ni n8n.

## 2. MediaFOX Forge (repositorio `Mediafox-ForgeOS`)

- Monorepo pnpm: `forgeos-web`, `movos-web`, `movos-api` (NestJS + Prisma + PostgreSQL), `naming-engine`; paquetes compartidos de configuración (`typescript-config`, `eslint-config`, `ui`, `shared-types`).
- `docs/forgeos/VERTICAL_BOUNDARIES.md` y `UNIVERSAL_PRIMITIVES.md` ya identifican primitivas universales que Hey Foxy necesita: **Recommendation** (sugerencia explicada y evidenciada), **Action** (caso con estado, responsable y resolución), **Timeline** (historial append-only) y **FSM** (transiciones validadas en servidor). Hey Foxy las adopta con el mismo vocabulario: _recomendación de Foxy_, _incidente_, _eventos de incidente_.

## 3. Servicios externos

| Servicio                       | Estado                                                                       | Observación                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Supabase                       | Organización `alipise`, 2 proyectos activos                                  | Un proyecto nuevo para Hey Foxy probablemente exige plan pago o pausar otro. **Verificar plan** antes de Gate 2 |
| Vercel                         | Equipo `mediafox` activo                                                     | Un proyecto nuevo `heyfoxy-web`. CLI desactualizada (56.2 → 65.x)                                               |
| n8n                            | **No hay instancia ni referencias**                                          | Decidir cloud vs autoalojado; revisar licencia (ver §4)                                                         |
| Twilio / WhatsApp Business API | **No hay cuenta ni integración**                                             | Requiere cuenta Meta Business verificada y número dedicado                                                      |
| Proveedores IA                 | OpenAI directo activo en MediaFOX OS; Vercel AI Gateway cableado sin crédito | Reutilizable como proveedor configurable                                                                        |
| Metricool                      | **Sin integración en código**                                                | Confirmar si MediaFOX tiene plan Advanced/Custom y si MedPlus está conectado ahí                                |

## 4. Dependencias y riesgos detectados en la auditoría

1. **Aislamiento**: compartir la base de MediaFOX OS mezclaría datos de escucha (terceros, volumen alto) con datos operativos de clientes → se descarta. Hey Foxy usa **base propia**.
2. **n8n — licencia**: la edición comunitaria usa _Sustainable Use License_; ofrecer n8n como parte de un SaaS comercial a terceros puede requerir licencia _Embed_. Por eso **la ruta crítica (ingesta, IA, alertas) va en código propio**, y n8n queda como capa opcional de automatizaciones internas. Validar términos antes de usarlo con clientes.
3. **Credenciales de terceros** (tokens Meta, Metricool, WhatsApp): hoy no existe bóveda; se diseña cifrado de aplicación (ver arquitectura §6).
4. **Cuenta Meta Business**: casi todas las rutas (Instagram, Facebook, WhatsApp) dependen de un portafolio Meta Business **verificado** y de App Review. Es la dependencia externa más larga.

## 5. Límites propuestos entre Hey Foxy y MediaFOX OS

| Hey Foxy (producto independiente)                                | MediaFOX OS (sin cambios en esta WO)                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Escucha, IA de conversación, alertas, incidentes, reportes       | Producción creativa: solicitudes, piezas, revisión, aprobaciones              |
| Su propia base, Auth, despliegue, facturación y marca            | Su propia base y despliegue                                                   |
| Puede **pedir** a MediaFOX OS crear una solicitud creativa (API) | Puede **informar** a Hey Foxy qué publicaciones salieron de qué campaña (API) |

Nunca comparten base de datos, sesión ni secretos. La integración es por API firmada y versionada (arquitectura §8).
