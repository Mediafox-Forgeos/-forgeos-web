# CAP-001 — MOVOS Product Readiness Assessment

**Fecha:** 2026-07-22 (verificado y anotado 2026-07-24, sin recalcular — ver nota abajo)
**Autor:** VULCAN, actuando como Principal Product Engineer
**Rama base original:** `main` @ `293498f` (post TECH-001)
**Alcance:** Solo lectura, análisis y evidencia. No se modificó código, no se crearon commits ni ramas, no se hizo deploy.
**Método:** Lectura directa de `schema.prisma`, todos los controllers/services/guards de `movos-api`, todas las páginas y datos de `movos-web`, `packages/shared-types`, y los archivos de configuración de build/test/deploy. Toda afirmación de este documento está respaldada por código leído en esta sesión, no por documentación previa sin verificar.

> **Nota de verificación (2026-07-24, WO-ARGOS-002):** se confirmó mediante `git diff --name-only 293498f..HEAD` que **ningún archivo de producto** (`apps/movos-api/src`, `apps/movos-web/app`, `apps/movos-web/src`, `apps/movos-api/prisma/schema.prisma`) cambió por razones de negocio entre el commit base de este documento y `main` actual (`bfea8db`) — los únicos cambios en esas rutas fueron de infraestructura (VULCAN-001: CI/CD y quality gates; PR #5: activación de rate limiting). **Las conclusiones de producto de este documento siguen vigentes sin cambios: capability inventory, MVP %, roadmap y recomendación final no se recalcularon porque nada que los sustente cambió.** Dos afirmaciones específicas de infraestructura quedaron desactualizadas por ese trabajo de ingeniería posterior y se anotaron inline donde aparecen (búsqueda: "RESUELTO"), sin borrar el hallazgo original. Este documento fue superseded como _fuente de verdad de producto_ por [`docs/product/MOVOS_PRODUCT_ATLAS_v1.0.md`](../product/MOVOS_PRODUCT_ATLAS_v1.0.md) (WO-ARGOS-001/002) — se conserva aquí como registro histórico del análisis original, no reemplazado ni eliminado.

---

## Executive Summary

MOVOS tiene **una columna vertebral de plataforma genuinamente sólida** — autenticación, multi-tenancy, y un primer recurso de dominio (Sites) están construidos con el nivel de rigor esperado de un producto comercial (guards que re-validan contra DB, rotación de tokens, auditoría, tests, tipado estricto de punta a punta). Pero esa columna vertebral **no sostiene todavía ningún módulo del dominio EV real**. Chargers, OCPP, Sessions, Tariffs, Alerts, Reports — el negocio que MOVOS existe para operar — son pantallas con datos estáticos en memoria, sin modelo en base de datos, sin API, sin lógica.

En términos de Principal Product Engineer: **MOVOS hoy es una plataforma de gestión de organizaciones y sitios con una demo de UI de carga eléctrica pegada encima.** Eso no es un insulto al trabajo hecho — la plataforma (auth+tenancy+sites) es exactamente el tipo de fundación que se necesita antes de construir el dominio, y está bien construida. Pero significa que **el MVP de MOVOS, en el sentido de "un operador puede gestionar cargadores reales", no ha comenzado.**

**Madurez estimada del MVP: ~32%** (ver Fase 7, cálculo ponderado por capacidad, no por líneas de código).

**Riesgo principal:** ninguno de los datos de `src/data/*.ts` (chargers, stations, connectors, sessions, tariffs, alerts, users, reports) tiene un modelo Prisma equivalente. Construir CAP-001 correctamente significa que **casi todo el trabajo restante es nuevo**, no "conectar UI existente a una API existente" — hay que diseñar el modelo de dominio EV desde cero.

---

## FASE 1 — Architecture Review

### Frontend

- `apps/movos-web`: Next.js 15 (App Router), React 19, Tailwind 3, TypeScript estricto.
- Enrutamiento: grupo de rutas `(app)` con layout compartido (`MovosShell`/`MovosSidebar`) para las 11 pantallas operativas; `/login` fuera del shell.
- **Gestión de estado:** un único React Context (`AuthProvider`) para sesión/usuario/organización activa. **No hay librería de estado de servidor** (no SWR, no TanStack Query, no Redux/Zustand). Cada página que consulta la API real hace su propio `fetch` manual con `useState`/`useEffect` (ver `sites/page.tsx`, `dashboard/_dashboard-live.tsx`) — no hay caché, revalidación, ni invalidación compartida entre pantallas.
- **Cliente API:** `src/lib/api-client.ts` — implementación propia, sólida: adjunta `Authorization: Bearer`, adjunta `X-Organization-Id`, maneja el ciclo 401→refresh-silencioso→retry, normaliza errores. Es la pieza de infraestructura frontend más madura del proyecto.
- **White-label:** `src/config/tenant.ts` — un único objeto (`productName`, `orgName`, `accentColor`, `currency`, `locale`) consumido en sidebar/settings. El patrón es correcto arquitectónicamente, pero **nunca se ha probado con un segundo tenant** — solo existe Kylum.
- Middleware (`middleware.ts`) protege rutas por la **presencia** de la cookie `movos_session` (no decodifica JWT) — delega la validación real a la API. Correcto y minimalista.

### Backend

- `apps/movos-api`: NestJS 10, monolito modular. Módulos reales: `Prisma` (infra), `Audit` (servicio transversal), `Auth`, `Organizations`, `Sites`, `Location`. `HealthController` standalone.
- Middlewares/filtros globales: `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`), `HttpExceptionFilter`, `CorrelationIdInterceptor`, `RequestLoggerMiddleware` (todas las rutas), `ThrottlerModule` global (120 req/min, sin límites por-ruta salvo `/locations/*`).
- `ConfigModule` con schema Joi (`env.validation.ts`) — variables de entorno validadas al boot, `abortEarly: false`.

### Base de datos

- PostgreSQL (Railway), Prisma 6.2. **6 modelos únicamente**: `User`, `Organization`, `Membership`, `Site`, `RefreshSession`, `AuditEvent`. 2 migraciones (`init`, `add_location_fields`). Cero modelos de dominio EV.

### Prisma

- `provider = postgresql`, cliente generado a `node_modules/.pnpm/@prisma+client@.../node_modules/@prisma/client` (hoisted, no local a la app — requiere `prisma generate` explícito, resuelto en TECH-001 vía `postinstall`).
- Sin `seed.ts` de datos de dominio EV (el seed existente solo crea la organización Kylum y el usuario owner).

### Autenticación

- Passport: estrategia `local` (login) + `jwt` (rutas protegidas). Access token JWT de 15 min, mantenido en memoria del cliente (nunca en `localStorage`). Refresh token opaco (UUID), hash SHA-256 en `RefreshSession`, cookie `httpOnly` + `SameSite=none` + `Secure` (necesario por el despliegue cross-domain Railway↔Vercel), rotación en cada refresh (el token anterior se revoca). Cookie adicional no-httpOnly (`movos_session`) solo como bandera de presencia para el middleware de Next.js — nunca contiene el JWT.
- **Gaps confirmados por código:** no existe endpoint de registro, ni de reset de contraseña, ni de invitación de usuarios (solo vía seed SQL manual). No hay 2FA. ~~No hay throttle específico en `/auth/login` — solo el límite global de 120 req/min compartido por toda la API.~~ **RESUELTO (PR #5, 2026-07-23):** `/auth/login` tiene throttle dedicado de 5 req/min; adicionalmente se descubrió que el límite global de 120 req/min nunca estuvo realmente activo (faltaba `ThrottlerGuard` como guard global) — también corregido en el mismo PR.

### Multi-tenancy

- `OrgContextGuard`: lee `X-Organization-Id` del header (o `orgId` del JWT como fallback), **siempre re-valida contra la tabla `Membership` en cada request** — nunca confía en el header por sí solo. Adjunta la `Membership` resuelta al request. Patrón correcto y probado (tests unitarios existen para `sites.service`, que depende de este aislamiento).
- Limitación real: **solo se aplica en el módulo `Sites`.** `Organizations` no tiene mutaciones que proteger (es de solo lectura). No hay todavía un segundo recurso de dominio que valide que el patrón se replica correctamente.

### Organización de paquetes

- Monorepo pnpm: `apps/{forgeos-web, forge-labs, movos-api, movos-web, naming-engine}`, `packages/{core-domain, eslint-config, naming-engine, shared-types, typescript-config, ui}`.
- `packages/shared-types/src/movos-api.ts` (112 líneas) es el único contrato compartido real: `ApiSite`, `ApiUser`, `ApiOrganization`, `ApiMembership`, `LoginResponse`, `MeResponse`, y los tipos de `Location*`. Prisma types **nunca** cruzan al frontend — cada entidad tiene un presenter (`toApiSite`, `toApiUser`, etc.) en `auth/presenters.ts`.
- `packages/core-domain` y `packages/ui` siguen siendo placeholders sin consumidores.

### Comunicación entre aplicaciones

- `movos-web` → `movos-api` exclusivamente vía REST/HTTP (`fetch`, `credentials: 'include'`). CORS configurado por env (`CORS_ORIGINS`). No hay ningún otro canal (sin WebSockets, sin colas, sin gRPC) — relevante porque **OCPP, el protocolo real para hablar con cargadores físicos, es intrínsecamente stateful/WebSocket**, y no existe absolutamente ninguna infraestructura de ese tipo hoy.

### API

- Prefijo global `/api/v1`. Recursos reales: `auth/*` (6 endpoints), `organizations` (1 endpoint, GET), `sites/*` (5 endpoints CRUD+archive), `locations/*` (2 endpoints, proxy a Google), `health` (1 endpoint público).
- **13 endpoints reales en total.** Ningún endpoint para chargers, stations, connectors, sessions, tariffs, alerts, reports, o gestión de usuarios de equipo.

### Documentación OpenAPI

- Swagger autogenerado desde decoradores (`@ApiTags`, `@ApiOperation`, `@ApiHeader`), montado en `/api/docs` **solo fuera de producción**, sin autenticación propia sobre esa ruta (documenta toda la superficie de API públicamente en dev/staging — riesgo ya señalado en auditorías previas, sigue vigente).

### Sistema de permisos

- RBAC vía `MemberRole` (enum de 6 valores: `OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER`) + `RolesGuard` + decorador `@Roles(...)`.
- **Hallazgo nuevo de esta auditoría:** de los 6 roles definidos, **solo 3 (`OWNER`, `ADMIN`, `OPERATOR`) aparecen en algún `@Roles()` del código.** `SUPPORT`, `ANALYST` y `VIEWER` existen en el schema y en los tipos, pero ningún endpoint los referencia — hoy se comportan idéntico a cualquier miembro `ACTIVE` (pueden leer todo lo que no tiene `@Roles()`, no pueden escribir nada porque ninguna mutación los incluye). El sistema de permisos está **sobre-especificado y sub-ejercitado**: el modelo de datos anticipa granularidad que la capa de aplicación no usa todavía.
- Todas las rutas `GET` (list, getById) están abiertas a cualquier miembro activo de la organización, sin importar el rol — solo las mutaciones (`POST`, `PATCH`, `archive`) están gateadas por rol.

### Diagrama textual de arquitectura actual

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                              │
│  movos-web (Next.js 15, Vercel)                                       │
│                                                                        │
│   AuthProvider (React Context)                                        │
│     - access token: memoria JS                                        │
│     - refresh: cookie httpOnly (movos_refresh)                        │
│     - presencia: cookie movos_session (leída por middleware.ts)       │
│                                                                        │
│   Páginas (App Router, grupo "(app)")                                 │
│     /dashboard  ──────────────► apiClient.get('/sites') (parcial)     │
│                 └─────────────► src/data/dashboard.ts        ❌ mock  │
│     /sites, /sites/[id] ─────► apiClient (GET/POST) → API real  ✅    │
│     /stations, /chargers,                                            │
│     /chargers/[id], /connectors,                                     │
│     /sessions, /sessions/[id],                                       │
│     /tariffs, /alerts, /users,                                       │
│     /reports ────────────────► src/data/*.ts (hardcoded)     ❌ mock │
│     /settings ────────────────► tenant.ts, sin persistencia   ❌ mock │
│                                                                        │
└──────────────────────────────┬─────────────────────────────────────┘
                                │ fetch, credentials:include
                                │ Bearer JWT + X-Organization-Id
┌──────────────────────────────▼─────────────────────────────────────┐
│  movos-api (NestJS 10, Railway) — prefijo /api/v1                    │
│                                                                        │
│  Pipeline global: ValidationPipe → RequestLoggerMiddleware →         │
│                    HttpExceptionFilter → CorrelationIdInterceptor    │
│                    ThrottlerModule (120 req/min global)              │
│                                                                        │
│  ┌─ auth/*        login · refresh · logout · me · select-org        │
│  ┌─ organizations  GET (solo lectura)                                 │
│  ┌─ sites/*        Guards: JwtAuthGuard → OrgContextGuard → RolesGuard│
│  │                 GET(all roles) POST/PATCH/archive(OWNER/ADMIN/OP) │
│  ┌─ locations/*    proxy Google Places (autocomplete, place details) │
│  └─ health          público, sin guards                              │
│                                                                        │
│  AuditService: registra eventos (SITE_CREATED, LOGIN_SUCCEEDED, ...) │
│                falla silenciosamente, nunca rompe la operación       │
│                                                                        │
│  ── SIN MÓDULOS PARA: chargers · stations · connectors · sessions ── │
│  ── tariffs · alerts · reports · gestión de usuarios de equipo ──    │
│  ── SIN infraestructura OCPP (WebSocket/stateful) en absoluto ──     │
└──────────────────────────────┬─────────────────────────────────────┘
                                │ Prisma 6.2
┌──────────────────────────────▼─────────────────────────────────────┐
│  PostgreSQL (Railway)                                                │
│  Modelos: User · Organization · Membership · Site ·                  │
│           RefreshSession · AuditEvent          (6 modelos, 0 EV)     │
└────────────────────────────────────────────────────────────────────┘
                                │
                     ┌──────────▼──────────┐
                     │  Google Maps API     │
                     │  (Places, Geocoding) │
                     └──────────────────────┘
```

---

## FASE 2 — Capability Inventory

| Capability         | Estado                               | Qué hace                                                                                                                                                                                                                                                                                                  | Qué falta                                                                                                                                                                                                           | Riesgos                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Authentication** | **Production Ready**                 | Login, refresh con rotación, logout con revocación, `/me`, selección de organización. bcrypt, JWT access en memoria, refresh httpOnly SHA-256.                                                                                                                                                            | Registro (signup), reset de contraseña, invitación de usuarios, 2FA.                                                                                                                                                | ~~Sin rate-limit específico en `/login` (brute-force).~~ **RESUELTO (PR #5).**                                                                                                                                                                               |
| **Organizations**  | **Partial**                          | `GET /organizations` lista las orgs del usuario.                                                                                                                                                                                                                                                          | Crear/editar organización vía API, gestión de membresías vía API, org-switcher funcional en UI (usa `organizations[0]` siempre).                                                                                    | Producto multi-organización de facto solo soporta una organización por usuario en la práctica.                                                                                                                                                               |
| **Users**          | **Mock**                             | Página `/users` muestra 5 usuarios de equipo hardcodeados (`isDemo: true` explícito en el tipo). El modelo `User`/`Membership` **sí existe** en DB (usado internamente por auth).                                                                                                                         | Ningún endpoint `GET/POST /users` para gestión de equipo. Cero conexión UI↔DB pese a que el modelo ya existe.                                                                                                       | Bajo riesgo técnico (el modelo ya está listo), pero es percepción de producto: la pantalla parece funcional y no lo es.                                                                                                                                      |
| **Roles**          | **Functional**                       | `MemberRole` enum de 6 valores, aplicado consistentemente en `Membership`.                                                                                                                                                                                                                                | Solo 3 de 6 roles (`OWNER/ADMIN/OPERATOR`) tienen algún efecto real en el código — `SUPPORT/ANALYST/VIEWER` no están conectados a ninguna regla. Sin UI para asignar/cambiar roles.                                 | Falsa sensación de granularidad — el modelo de datos promete más control del que la aplicación ejerce.                                                                                                                                                       |
| **Permissions**    | **Functional** (probado en 1 módulo) | `OrgContextGuard` + `RolesGuard`, re-validación server-side contra DB en cada request, patrón sólido y con tests.                                                                                                                                                                                         | Solo ejercitado en `Sites`. No hay un segundo recurso que confirme que el patrón escala sin fricción.                                                                                                               | Ninguno inmediato — el patrón es correcto; el riesgo es de cobertura, no de diseño.                                                                                                                                                                          |
| **Sites**          | **Production Ready**                 | CRUD completo (crear, listar, detalle, actualizar, archivar), aislamiento por organización probado, slug único, auditoría en cada mutación, UI conectada end-to-end.                                                                                                                                      | Paginación, filtros/búsqueda, confirmación de archivado en UI, edición desde el detalle (solo lectura hoy).                                                                                                         | Ninguno crítico; deuda de UX/escala menor.                                                                                                                                                                                                                   |
| **Location**       | **Production Ready**                 | Autocomplete y resolución de lugar vía Google Places, degradación graceful sin key, session tokens para costo, contratos normalizados (`LocationSuggestion`, `ResolvedLocation`), tests.                                                                                                                  | Restricción de tipo de lugar sin decidir (ver ADR-0007, corregido en TECH-001), fallback de Geocoding para direcciones libres.                                                                                      | Bajo. Es el módulo más maduro del dominio, aunque técnicamente es infraestructura de Sites, no una capability de negocio por sí sola.                                                                                                                        |
| **Chargers**       | **Mock**                             | Página lista + detalle con 6 cargadores hardcodeados (Kempower, ABB, Alpitronic), incluye estado `FAULTED` de ejemplo.                                                                                                                                                                                    | Modelo Prisma, API, cualquier lógica real. 0% de backend.                                                                                                                                                           | Es una de las 3 capacidades de mayor peso para el MVP (junto a OCPP y Sessions) y está en 0 real.                                                                                                                                                            |
| **OCPP**           | **Planned**                          | Solo aparece como texto estático (`"OCPP 1.6J"`) en Settings y como campo de metadata en los datos mock de chargers/alerts.                                                                                                                                                                               | Todo: no existe servidor WebSocket, no hay manejo de mensajes OCPP (BootNotification, StatusNotification, StartTransaction, etc.), no hay ningún componente stateful en la arquitectura actual capaz de sostenerlo. | **El mayor riesgo técnico del roadmap.** Es un protocolo con semántica de conexión persistente; la arquitectura HTTP-request/response actual no tiene ningún punto de apoyo para esto — es una pieza de infraestructura nueva, no una extensión incremental. |
| **Sessions**       | **Mock**                             | Lista + detalle de sesiones de carga, con estado `ACTIVE`/histórico, referencias a charger/connector/tariff/user.                                                                                                                                                                                         | Modelo Prisma, API, y — más importante — la fuente real de estas sesiones sería OCPP (`StartTransaction`/`StopTransaction`), así que Sessions depende de que OCPP exista primero.                                   | Depende de OCPP; no se puede paralelizar completamente.                                                                                                                                                                                                      |
| **Vehicles**       | **Planned**                          | No existe ni como mock. Ningún tipo, dato, ni mención en todo el código de `movos-web`/`movos-api`.                                                                                                                                                                                                       | Todo.                                                                                                                                                                                                               | Bajo para el MVP actual: MOVOS es una plataforma para el **operador de infraestructura** (Kylum), no un gestor de flotas de vehículos — este capability puede no ser core del MVP en absoluto (ver Fase 9).                                                  |
| **Fleet**          | **Planned**                          | Igual que Vehicles: cero presencia en el código.                                                                                                                                                                                                                                                          | Todo.                                                                                                                                                                                                               | Igual razonamiento que Vehicles — candidato a excluirse del alcance del MVP actual, no solo a posponerse.                                                                                                                                                    |
| **Tariffs**        | **Mock**                             | Página con 1+ tarifas hardcodeadas en COP (precio por kWh, por minuto, fee de sesión), asociadas a sitios.                                                                                                                                                                                                | Modelo Prisma, API, aplicación real de la tarifa a una sesión de carga.                                                                                                                                             | Depende de Sessions para tener sentido operativo completo.                                                                                                                                                                                                   |
| **Billing**        | **Planned**                          | Cero código, cero mock, cero mención. La palabra "Facturación" aparece una vez en Settings como campo deshabilitado (`"No conectado"`).                                                                                                                                                                   | Todo: no hay ni siquiera un concepto de invoice/pago en los tipos.                                                                                                                                                  | Depende de Tariffs + Sessions. Es razonable que esté al final del roadmap.                                                                                                                                                                                   |
| **Notifications**  | **Planned**                          | Cero código funcional; solo dos campos deshabilitados en Settings (`Correo`, `Webhook`, ambos `"No configurado"`).                                                                                                                                                                                        | Todo.                                                                                                                                                                                                               | Bajo impacto de MVP inicial, alto impacto operativo una vez que Alerts/Sessions sean reales (un operador necesita que le avisen, no que entre a mirar un dashboard).                                                                                         |
| **Reporting**      | **Mock**                             | Catálogo de 2+ tipos de reporte, cada uno con `available: false` explícito en el dato — el producto mismo declara que no está implementado.                                                                                                                                                               | Toda la generación real; depende de que exista data real de Sessions/Chargers para tener contenido que reportar.                                                                                                    | Ninguno nuevo; es honestamente el estado más "autoconsciente" del inventario (el propio código documenta que no funciona).                                                                                                                                   |
| **AI**             | **Planned**                          | Cero integración de ningún modelo/proveedor de IA dentro de `movos-api` o `movos-web`. La posición de "AI-native" en `docs/product/MOVOS.md` es completamente aspiracional hoy. ARGOS (el agente de IA) vive únicamente en `forgeos-web`, un producto distinto, y no tiene ninguna integración con MOVOS. | Todo.                                                                                                                                                                                                               | Ninguno técnico inmediato — pero es una discrepancia de mensaje: el posicionamiento de producto promete algo que el código no empezó a construir.                                                                                                            |
| **White Label**    | **Functional**                       | `tenant.ts` es un patrón real y correcto (un solo archivo controla marca, moneda, locale). Consumido correctamente en sidebar y settings.                                                                                                                                                                 | Nunca se ha probado con un segundo tenant real; Settings no persiste cambios (todos los campos están `disabled`).                                                                                                   | Bajo — el patrón es sólido, el riesgo es que está "probado con n=1".                                                                                                                                                                                         |

---

## FASE 3 — Modelo de datos

**Entidades actuales (6):** `User`, `Organization`, `Membership`, `Site`, `RefreshSession`, `AuditEvent`.

**Relaciones:**

- `User 1—N Membership N—1 Organization` (tabla de unión con rol/estado, `@@unique([userId, organizationId])` — correcto, previene membresías duplicadas).
- `Organization 1—N Site`, `User 1—N Site` (como `createdBy`).
- `User 1—N RefreshSession`.
- `Organization 1—N AuditEvent` (opcional), `User 1—N AuditEvent` (opcional, como actor) — ambas relaciones son nullable, lo cual es correcto para permitir eventos de sistema sin actor humano.

**Entidades incompletas:**

- `Site` tiene 10 campos de ubicación enriquecida pero `locationValidatedAt` nunca se popula en el código de servicio (`sites.service.ts` no lo asigna en ningún punto) — el campo existe en el schema pero la lógica que le daría sentido no está escrita.
- `MemberRole` (enum) tiene 6 valores pero solo 3 tienen consumidores en el código — no es que el enum esté mal, es que la mitad no tiene ningún camino de código que lo verifique.

**Entidades faltantes (para el dominio EV central):**
`Station`, `Charger`, `Connector`, `ChargingSession`, `Tariff`, `Alert` — ninguna existe. Estas son exactamente las 6 entidades que las páginas de `movos-web` ya modelan en TypeScript (`src/types/{station,charger,connector,session,tariff,alert}.ts`) sin backing en Prisma. El "contrato deseado" ya está escrito en el frontend; falta el modelo real.

**Duplicaciones:** ninguna detectada dentro de Prisma. Sí existe una duplicación conceptual entre `src/types/*.ts` (frontend, con campo `isDemo: true` explícito) y lo que eventualmente deberá ser `ApiStation`/`ApiCharger`/etc. en `shared-types` — es deuda esperable de este punto del proyecto, no un error.

**Preparación para escalabilidad:**

- IDs `cuid()` en todos los modelos — correcto, sin auto-increment secuencial expuesto.
- Ninguna tabla tiene índices explícitos más allá de las claves únicas/foráneas implícitas de Prisma — a la escala actual (una organización piloto) es irrelevante, pero `AuditEvent` (que crecerá sin límite natural) no tiene índice sobre `organizationId` ni `occurredAt`, lo que será un problema de rendimiento el día que existan consultas de auditoría por rango de fecha.
- Sin soft-delete consistente: `Site` usa `status: ARCHIVED` (soft), pero no hay un patrón declarado para las entidades futuras — vale la pena decidirlo antes de CAP-002, no después.
- Sin particionamiento ni consideración de multi-región — no es necesario todavía, se menciona solo porque "escalabilidad" fue pedido explícitamente.

No se proponen cambios — según lo solicitado.

---

## FASE 4 — Frontend: Inventario de pantallas

| Pantalla                | Propósito                                                    | Estado                                     | Navegación               | Componentes reutilizables                                | Deuda UX                                                                                                                              | Deuda técnica                                                                                              |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------ | ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/dashboard`            | Resumen ejecutivo de red                                     | Parcial (mezcla 1 fetch real + datos mock) | Sidebar, raíz post-login | `MetricCard`, `ActivityFeed` (vía `_dashboard-live.tsx`) | Métricas ejecutivas no reflejan datos reales — riesgo de decisión basada en números falsos si se muestra a un stakeholder sin aclarar | Mezcla fuente real y mock en la misma vista sin un límite visual claro                                     |
| `/sites`                | Listado de sitios                                            | **Production Ready**                       | Sidebar                  | `DataTable`, `EmptyState`                                | Ninguna significativa                                                                                                                 | Sin paginación (asumible al volumen actual)                                                                |
| `/sites/[siteId]`       | Detalle de sitio                                             | **Production Ready** (lectura)             | Desde `/sites`           | `Tabs`, `SiteMap`                                        | Solo lectura — no se puede editar desde aquí                                                                                          | —                                                                                                          |
| `/sites` (modal)        | Crear sitio                                                  | **Production Ready**                       | Modal desde `/sites`     | `LocationPicker`                                         | Sin confirmación post-creación más allá del cierre del modal                                                                          | —                                                                                                          |
| `/stations`             | Listado de estaciones                                        | Mock                                       | Sidebar                  | `DataTable`, `StatusBadge`                               | Datos ficticios sin aviso más allá del `DemoBanner` global                                                                            | Sin modelo backing                                                                                         |
| `/chargers`             | Inventario de cargadores                                     | Mock                                       | Sidebar                  | `DataTable`                                              | —                                                                                                                                     | Sin modelo backing                                                                                         |
| `/chargers/[chargerId]` | Detalle de cargador                                          | Mock                                       | Desde `/chargers`        | `Tabs`                                                   | —                                                                                                                                     | Sin modelo backing                                                                                         |
| `/connectors`           | Listado de conectores                                        | Mock                                       | Sidebar                  | `DataTable`                                              | —                                                                                                                                     | Sin modelo backing                                                                                         |
| `/sessions`             | Listado de sesiones de carga                                 | Mock                                       | Sidebar                  | `DataTable`                                              | —                                                                                                                                     | Sin modelo backing; depende conceptualmente de OCPP                                                        |
| `/sessions/[sessionId]` | Detalle de sesión                                            | Mock                                       | Desde `/sessions`        | `Tabs`                                                   | —                                                                                                                                     | Igual                                                                                                      |
| `/users`                | Directorio de equipo                                         | Mock                                       | Sidebar                  | `DataTable`                                              | Pantalla parece de gestión real de usuarios; no lo es                                                                                 | Modelo `User` ya existe en DB, solo falta exponerlo — la brecha más barata de cerrar de todo el inventario |
| `/tariffs`              | Definición de tarifas                                        | Mock                                       | Sidebar                  | `DataTable`                                              | —                                                                                                                                     | Sin modelo backing                                                                                         |
| `/alerts`               | Alertas operativas                                           | Mock (con toggle de estado local)          | Sidebar                  | `EmptyState`, `StatusBadge`                              | El toggle da sensación de interactividad real sin persistencia                                                                        | Sin modelo backing                                                                                         |
| `/reports`              | Catálogo de reportes                                         | Mock, `available: false` explícito         | Sidebar                  | `Card`                                                   | Ninguna — es honesto sobre su propio estado                                                                                           | Sin generación real                                                                                        |
| `/settings`             | Configuración de org/marca/moneda/idioma/OCPP/notificaciones | Prototype (todos los campos `disabled`)    | Sidebar                  | `Tabs`, `Card`, `Input`                                  | Botón "Guardar cambios" visible pero deshabilitado — puede confundir a un usuario piloto                                              | Sin persistencia de ningún tipo, ni siquiera local                                                         |
| `/login`                | Autenticación                                                | **Production Ready**                       | Pública                  | —                                                        | —                                                                                                                                     | —                                                                                                          |

**Patrón transversal:** el `DemoBanner` (banner dismissible "Entorno piloto · Datos de demostración") y el `DemoNotice` (badge inline) están correctamente implementados y usados — el producto es honesto visualmente sobre su estado de demo. Esto reduce el riesgo de percepción, pero no cambia el estado real de las capacidades.

---

## FASE 5 — Backend: Inventario de módulos

| Módulo          | Endpoints                                                                                        | Cobertura                                                                                    | Validaciones                                                                       | Autenticación                                    | Autorización                                              | Tests                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `auth`          | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /select-organization` (5)       | Login/sesión completo; sin signup/reset/invite                                               | `LoginDto`, `SelectOrgDto` (class-validator)                                       | `LocalAuthGuard` (login), `JwtAuthGuard` (resto) | N/A (no hay recurso multi-tenant en este módulo)          | `auth.service.spec.ts` — cubre login, refresh, rotación, revocación                                                    |
| `organizations` | `GET /organizations` (1)                                                                         | Solo lectura                                                                                 | N/A (sin body)                                                                     | `JwtAuthGuard`                                   | Implícita (solo devuelve orgs del propio usuario)         | Ninguno dedicado                                                                                                       |
| `sites`         | `GET /sites`, `POST /sites`, `GET /sites/:id`, `PATCH /sites/:id`, `POST /sites/:id/archive` (5) | CRUD completo salvo delete físico (por diseño — usa archive)                                 | `CreateSiteDto`, `UpdateSiteDto` (class-validator, incluye 10 campos de ubicación) | `JwtAuthGuard`                                   | `OrgContextGuard` + `RolesGuard` (`@Roles` en mutaciones) | `sites.service.spec.ts`, `slugify.spec.ts` — cobertura sólida, incluye conflicto de slug y aislamiento de organización |
| `location`      | `GET /locations/autocomplete`, `GET /locations/place/:placeId` (2)                               | Proxy completo a Google Places                                                               | `AutocompleteQueryDto`, `PlaceQueryDto`                                            | `JwtAuthGuard`                                   | Ninguna específica de rol (cualquier miembro autenticado) | `location.service.spec.ts` — 14 casos, incluye 2 tests de seguridad (no expone payload crudo de Google ni la API key)  |
| `health`        | `GET /health` (1)                                                                                | Liveness probe                                                                               | N/A                                                                                | Pública (sin guard)                              | N/A                                                       | Ninguno (no lo necesita)                                                                                               |
| `audit`         | Sin controller (servicio interno, invocado desde otros módulos)                                  | Registra eventos en `sites` y `auth`; falla silenciosamente sin romper la operación primaria | N/A                                                                                | N/A                                              | N/A                                                       | Ninguno dedicado (se ejercita indirectamente vía los tests de `sites`)                                                 |

**e2e:** existen `auth.e2e-spec.ts` y `tenant-isolation.e2e-spec.ts` — ambos requieren una base de datos real y **no se ejecutan** en ningún pipeline. ~~(no hay CI)~~ **ACTUALIZADO:** CI existe desde VULCAN-001 (`.github/workflows/ci.yml`), pero corre `pnpm test` (Jest unitario, mockea Prisma), no `pnpm test:e2e` — no hay servicio de base de datos en CI. La conclusión original se mantiene: siguen sin correr en ningún pipeline, siguen siendo código muerto en la práctica hasta que exista un entorno de ejecución con DB real. Ver `docs/engineering/TESTING_STRATEGY.md`.

**Cobertura global:** 4 suites unitarias, 35 tests, 100% passing. `collectCoverageFrom` está configurado en `jest.config.js` pero **no hay `coverageThreshold`** — la cobertura se puede medir pero nada la exige; es posible bajarla sin que ningún gate lo detecte.

---

## FASE 6 — Calidad (evaluación de producto, no de repositorio)

- **Cobertura de tests:** fuerte donde existe (auth, sites, location — exactamente los 3 módulos reales), inexistente en frontend (0 tests en `movos-web`, confirmado en TECH-001) y, por definición, inexistente en todo lo que aún es mock.
- **Separación de responsabilidades:** buena en backend (controller→service→Prisma, DTOs separados, presenters separados de entidades Prisma). En frontend es más débil: las páginas mock mezclan fetching-de-mock, presentación, y formato en el mismo archivo `page.tsx` — aceptable para prototipos descartables, pero si alguna de estas pantallas se conecta a datos reales sin refactor, esa mezcla se volverá deuda real rápido.
- **Consistencia:** alta entre los 2 módulos reales del dominio (Sites, Location) — mismo patrón de guards, mismo patrón de DTO, mismo patrón de auditoría. Esto es una señal positiva fuerte: **el equipo ya sabe cómo construir un módulo de dominio bien** — el problema no es falta de patrón, es falta de módulos.
- **Escalabilidad:** el patrón de tenancy (guard + revalidación DB) escala razonablemente bien a más recursos. El patrón de frontend (fetch manual por página, sin caché compartida) **no** escala bien más allá de un puñado de pantallas — cuantas más pantallas se conecten a datos reales, más notorio será no tener una capa de data-fetching compartida.
- **Deuda técnica de producto** (no de repositorio, ver TECH-001 para eso): la principal es la brecha frontend-tipos vs. backend-modelos — 6 tipos de dominio EV completamente diseñados en TypeScript sin ningún Prisma model equivalente. Es deuda "de diseño ya hecho, implementación pendiente" — en realidad es una ventaja: el contrato de datos ya fue pensado una vez (en los tipos de `movos-web/src/types`), lo cual acelera CAP-002 si se reutiliza ese diseño en vez de rehacerlo desde cero en Prisma.
- **Observabilidad:** `CorrelationIdInterceptor` + `RequestLoggerMiddleware` existen (correlación de requests, logging estructurado básico). Cero APM/error-tracking (Sentry o equivalente) — confirmado ausente, ya señalado en auditorías previas y sigue así.
- **Seguridad:** los 2 módulos reales del dominio (Sites, Location) siguen buenas prácticas (guards re-validados server-side, throttling en Location, ningún payload crudo de terceros expuesto). ~~El gap de seguridad más concreto sigue siendo la ausencia de rate-limit dedicado en `/auth/login`.~~ **RESUELTO (PR #5)** — y se descubrió en el proceso que el throttling de `LocationController` tampoco estaba realmente activo (mismo bug de fondo: faltaba `ThrottlerGuard` global).

---

## FASE 7 — MVP Readiness

Cálculo por capacidad, ponderado por relevancia para un MVP operable de gestión de infraestructura de carga EV (no por líneas de código ni número de pantallas). Fracción de completitud por estado: Production Ready=100%, Functional=75%, Partial=40%, Prototype=15%, Mock=5%, Planned=0%.

| Capability     |    Peso | Estado           | Contribución al MVP |
| -------------- | ------: | ---------------- | ------------------: |
| Authentication |      10 | Production Ready |                10.0 |
| Sites          |       8 | Production Ready |                 8.0 |
| Location       |       4 | Production Ready |                 4.0 |
| Roles          |       3 | Functional       |                2.25 |
| Permissions    |       3 | Functional       |                2.25 |
| White Label    |       2 | Functional       |                 1.5 |
| Organizations  |       5 | Partial          |                 2.0 |
| Sessions       |      13 | Mock             |                0.65 |
| Chargers       |      11 | Mock             |                0.55 |
| Users          |       5 | Mock             |                0.25 |
| Tariffs        |       5 | Mock             |                0.25 |
| Reporting      |       4 | Mock             |                 0.2 |
| OCPP           |      13 | Planned          |                 0.0 |
| Billing        |       6 | Planned          |                 0.0 |
| Notifications  |       3 | Planned          |                 0.0 |
| Vehicles       |       2 | Planned          |                 0.0 |
| Fleet          |       2 | Planned          |                 0.0 |
| AI             |       1 | Planned          |                 0.0 |
| **Total**      | **100** |                  |            **31.9** |

### **MVP de MOVOS: ~32% construido.**

Lectura del número: el 32% no está repartido uniformemente — está casi enteramente concentrado en **fundación de plataforma** (Auth+Sites+Location+Roles+Permissions+White Label = ~30 de los 32 puntos). Los tres capabilities de mayor peso combinado del dominio real (Chargers+OCPP+Sessions = 37 puntos posibles, el bloque individual más grande de toda la tabla) aportan apenas **1.2 puntos combinados**. Esto confirma cuantitativamente lo que la lectura cualitativa del código ya mostraba: **la plataforma está lista para recibir el dominio EV; el dominio EV en sí casi no ha empezado.**

---

## FASE 8 — Roadmap por capacidades (ordenado por dependencia)

```
FOUNDATIONAL (bloquean todo lo demás, hacer primero)
  1. Station, Charger, Connector — modelos Prisma + API CRUD
     (sin esto, nada del dominio EV puede dejar de ser mock)
  2. Users API (GET/POST/PATCH /users, gestión de membresías)
     (el modelo ya existe; es la ganancia más barata del roadmap)

HIGH IMPACT (dependen de Foundational, entregan valor de negocio directo)
  3. ChargingSession — modelo + API (lectura/histórico primero, sin OCPP en vivo todavía)
  4. Tariff — modelo + API + aplicación real a una sesión
  5. OCPP — servidor WebSocket + manejo de mensajes core
     (BootNotification, StatusNotification, StartTransaction, StopTransaction,
     MeterValues) — esto es lo que convierte Sessions de "histórico manual"
     a "reflejo de la realidad física"

QUICK WINS (bajo esfuerzo, valor de producto o percepción inmediato)
  6. Users API (ver arriba — también calza aquí por costo/beneficio)
  7. [RESUELTO — PR #5] Rate limiting en /auth/login (@nestjs/throttler ya instalado, falta configurar la ruta)
  8. Org-switcher funcional en el frontend (el backend /organizations ya lo soporta)
  9. Persistencia real en /settings (aunque sea solo el tab de Organización)

FUTURE (dependen de varios Foundational/High Impact, no bloquean el MVP inicial)
  10. Alert — modelo + generación real (depende de que Chargers/Sessions existan
      para tener eventos reales que alertar)
  11. Billing — depende de Tariffs + Sessions maduros
  12. Reporting real — depende de tener datos reales de Sessions/Chargers que reportar
  13. Notifications — depende de Alerts real para tener algo que notificar
  14. Vehicles / Fleet — evaluar si son parte del MVP en absoluto (ver Fase 9)
  15. AI — el posicionamiento de producto lo promete; no hay ninguna base construida.
      No es bloqueante para el MVP operativo, pero si es parte de la promesa de
      venta debería al menos tener un ADR de alcance antes de CAP-003 o CAP-004.
```

---

## FASE 9 — Recomendación del Lead Engineer

**¿Qué construiría primero?**
`Station` → `Charger` → `Connector` como un solo capítulo de trabajo (CAP-001 tal como está nombrado), replicando exactamente el patrón ya probado en `Sites`: mismo estilo de guard, mismo estilo de DTO, mismo estilo de auditoría. No hay que inventar arquitectura nueva — hay que repetir la que ya funciona. Inmediatamente después, `Users API`, porque el modelo ya existe y es la relación esfuerzo/impacto más favorable de todo el roadmap.

**¿Qué NO construiría todavía?**
OCPP real, en su forma completa. Es la pieza de mayor riesgo técnico (WebSocket/stateful, protocolo con estado de conexión persistente, ninguna infraestructura hoy que lo sostenga) y de mayor peso en el MVP — exactamente la combinación que amerita **no** empezarla hasta tener `Charger`/`Connector` estables y al menos un consumidor real de esos datos. Empezar OCPP antes que el modelo de dominio esté firme arriesga tener que rehacer el trabajo de integración cuando el modelo cambie.

**¿Qué NO construiría, punto final (no solo "todavía")?**
`Vehicles` y `Fleet`. MOVOS, según su propio posicionamiento (`docs/product/MOVOS.md`), es una plataforma para **operadores de infraestructura de carga** (Kylum gestiona estaciones, no una flota de vehículos). Nada en el código, en los datos mock, ni en la documentación de producto sugiere que gestión de vehículos/flotas sea parte de la propuesta de valor. Antes de darles peso en el roadmap, valdría más una conversación de producto explícita sobre si pertenecen al alcance en absoluto, en vez de asumir que "aparecen en la lista esperada" significa que hay que construirlos.

**¿Qué eliminaría?**
Nada del código actual — no hay nada que sea activamente dañino o que deba borrarse. Sí eliminaría la ambigüedad: la afirmación de "AI-native" en `docs/product/MOVOS.md` debería reformularse como aspiracional/roadmap explícitamente, no como descripción del estado actual, mientras no exista ni un ADR de alcance para AI.

**¿Qué consolidaría?**
Los 6 tipos de dominio EV que hoy viven solo en `apps/movos-web/src/types/*.ts` deberían ser el punto de partida del diseño de los modelos Prisma — no rediseñar desde cero. Ese trabajo de modelado ya se hizo una vez, bien, y descartarlo sería repetir esfuerzo innecesariamente.

**¿Qué refactorizaría?**
La ausencia de una capa de data-fetching compartida en `movos-web` (sin SWR/TanStack Query). Hoy es tolerable con 2 pantallas reales; se volverá dolorosa exactamente en el momento en que CAP-001 conecte 3-4 pantallas más a datos reales de golpe. Vale la pena resolverlo **antes** de esa ola de conexión, no después — es mucho más barato adoptar un patrón de fetching compartido con 2 consumidores que con 8.

**¿Qué capability debería convertirse en CAP-002?**
`ChargingSession` (lectura/histórico) + `Tariff`, inmediatamente después de que `Charger`/`Connector` (CAP-001) estén estables — es el siguiente eslabón de dependencia directa, y es lo que empieza a darle a MOVOS su primera métrica de negocio real (energía entregada, ingresos potenciales) sin todavía requerir la complejidad de OCPP en vivo.

---

## Risk Matrix

| Riesgo                                                                                                               | Severidad        | Área                 |
| -------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| OCPP no tiene ninguna infraestructura base (WebSocket/stateful) y es el mayor peso individual del MVP restante       | Alta             | Arquitectura/Roadmap |
| ~~`/auth/login` sin rate-limit dedicado~~ **RESUELTO (PR #5)**                                                       | ~~Alta~~ Cerrado | Seguridad            |
| Dashboard mezcla datos reales y mock sin distinción visual — riesgo de decisión basada en números falsos             | Media            | Producto             |
| Sistema de roles sobre-especificado (6 valores) vs. sub-ejercitado (3 usados) — falsa sensación de control de acceso | Media            | Producto/Seguridad   |
| Sin capa de data-fetching compartida en frontend — no escalará bien a más pantallas reales                           | Media            | Arquitectura         |
| `locationValidatedAt` nunca se popula pese a existir en schema                                                       | Baja             | Modelo de datos      |
| `AuditEvent` sin índices sobre `organizationId`/`occurredAt`                                                         | Baja             | Escalabilidad        |
| Posicionamiento "AI-native" sin ninguna base de código construida                                                    | Baja             | Producto/Mensaje     |

## Technical Debt (producto, no repositorio — ver TECH-001 para deuda de infraestructura de repo)

- Ausencia de capa de data-fetching compartida (frontend).
- `MemberRole` con 3 de 6 valores sin consumidores.
- `locationValidatedAt` sin lógica de asignación.
- Sin `coverageThreshold` en Jest — cobertura medible pero no exigida.
- e2e specs existentes (`auth.e2e-spec.ts`, `tenant-isolation.e2e-spec.ts`) sin entorno de ejecución — código muerto en la práctica.

## Product Debt

- 9 de 15 pantallas operativas son 100% mock sin ningún camino de datos real.
- Settings es un formulario completo sin ninguna persistencia, incluyendo un botón "Guardar" visiblemente deshabilitado.
- Org-switcher inexistente pese a que el backend ya lo soportaría con mínimo esfuerzo adicional.
- Mensaje de posicionamiento de producto ("AI-native") no respaldado por ninguna implementación.

---

## Recomendación final

MOVOS no necesita "más pulido" antes de CAP-001 — necesita **empezar el dominio**. La plataforma (auth, tenancy, sites, location) es de calidad suficiente para servir de base sin retrabajo. El riesgo no está en la calidad de lo construido; está en la composición del roadmap: el bloque de mayor peso del MVP (Chargers+OCPP+Sessions) es también el que tiene mayor riesgo técnico (OCPP) y mayor volumen de trabajo nuevo (sin modelo Prisma existente para ninguno). Recomiendo secuenciar CAP-001 exactamente como está nombrado (Station/Charger/Connector), seguido de Users API como quick win intercalado, y tratar OCPP como su propio capítulo de arquitectura — no como una tarea más dentro de Chargers — dado el salto de complejidad que representa frente a todo lo construido hasta ahora.

No se implementó ningún cambio. Quedo a la espera de instrucciones de ARGOS.
