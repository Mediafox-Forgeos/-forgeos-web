# MOVOS Platform — Auditoría de Estado Actual

**Fecha:** 2026-07-19  
**Auditor:** VULCAN / Claude Sonnet 4.6  
**Rama:** `main` · commit `de8f1f3`  
**Alcance:** No destructivo. Solo lectura, lint, typecheck, tests y build locales.

---

## 1. Resumen Ejecutivo

MOVOS es una plataforma SaaS de gestión de infraestructura de carga eléctrica (EV) construida sobre un monorepo pnpm. El proyecto tiene una **Platform Foundation parcialmente implementada**: autenticación completa, multi-tenancy funcional, modelo de datos para sitios con geolocalización Google Maps, y despliegue productivo en Railway + Vercel.

Sin embargo, **el 90 % de las pantallas de la aplicación muestran datos hardcodeados (demo)** y no tienen backing en base de datos ni APIs reales. Los modelos de dominio EV core (Charger, Station, Connector, Session, Tariff, Alert) no existen en Prisma ni en la API. El proyecto está listo para comenzar el desarrollo real del dominio EV (CAP-001).

| Dimensión | Estado |
|---|---|
| Infraestructura de autenticación | ✅ Completa y en producción |
| Multi-tenancy | ✅ Completa y en producción |
| Modelo de datos Sites + Location | ✅ Completo y en producción |
| Pantallas Sites (lista + detalle + crear) | ✅ Conectadas a API real |
| Resto de pantallas (11 módulos) | ❌ Datos hardcodeados / demo |
| Modelos EV domain (Charger, Station, etc.) | ❌ No existen en DB ni en API |
| CI/CD | ❌ No configurado |
| Tests frontend | ❌ No existen |
| Monitoreo de errores | ❌ No configurado |

---

## 2. Inventario Técnico

### Stack

| Componente | Tecnología | Versión |
|---|---|---|
| Package manager | pnpm | 11.5.3 (latest: 11.15.1) |
| API runtime | Node.js + NestJS | NestJS 10.4.x |
| API language | TypeScript | 5.7.2 |
| ORM | Prisma | 6.2.1 |
| Base de datos | PostgreSQL | Railway-managed |
| Frontend framework | Next.js App Router | 15.5.20 |
| Frontend language | TypeScript + React | React 19.1.1 |
| CSS | Tailwind CSS | 3.4.17 |
| UI components | shadcn/ui pattern | (in-app, no package) |
| Maps | @vis.gl/react-google-maps | 1.9.0 |
| Auth | Passport JWT + bcrypt | JWT 10.2.0 |
| API deploy | Railway | service `movos-api` |
| Web deploy | Vercel | project `movos-web` |
| Monorepo | pnpm workspaces | 12 packages |

### Aplicaciones en el monorepo

| App | Descripción | Estado |
|---|---|---|
| `apps/movos-api` | API NestJS — backend MOVOS | ✅ En producción |
| `apps/movos-web` | Next.js 15 — consola MOVOS | ✅ En producción |
| `apps/forgeos-web` | App separada (ForgeOS platform web) | 🔵 Independiente |
| `apps/forge-labs` | Laboratorio interno (naming engine UI) | 🔵 Independiente |
| `apps/naming-engine` | Herramienta de naming de marca | 🔵 Independiente |

### Packages compartidos

| Package | Descripción | Usado por MOVOS |
|---|---|---|
| `packages/shared-types` | Contratos API (ApiSite, ApiUser, etc.) | ✅ movos-api + movos-web |
| `packages/core-domain` | **Placeholder** — "Reserved for Mission 003" | ❌ No implementado |
| `packages/typescript-config` | TSConfig base y Next.js | ✅ Todos |
| `packages/eslint-config` | ESLint compartido | ✅ Todos |
| `packages/ui` | Componentes UI compilados | ⚠️ Compilado pero no importado en movos-web |
| `packages/naming-engine` | Motor de naming de marcas | ❌ No relacionado con MOVOS |

---

## 3. Mapa de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Vercel CDN)                                        │
│  movos-web · Next.js 15 App Router                          │
│  ┌─────────┐ ┌──────────────────────────────────────────┐  │
│  │ Auth    │ │  Pages                                   │  │
│  │ Context │ │  /dashboard    → static demo data        │  │
│  │ (mem)   │ │  /sites ───────→ API real ✅             │  │
│  │         │ │  /sites/[id] ──→ API real ✅             │  │
│  │ JWT in  │ │  /chargers ────→ hardcoded /data/*.ts ❌ │  │
│  │ memory  │ │  /stations ────→ hardcoded /data/*.ts ❌ │  │
│  │         │ │  /connectors ──→ hardcoded /data/*.ts ❌ │  │
│  │ Refresh │ │  /sessions ────→ hardcoded /data/*.ts ❌ │  │
│  │ in      │ │  /users ───────→ hardcoded /data/*.ts ❌ │  │
│  │ httpOnly│ │  /tariffs ─────→ hardcoded /data/*.ts ❌ │  │
│  │ cookie  │ │  /alerts ──────→ hardcoded /data/*.ts ❌ │  │
│  └─────────┘ │  /reports ─────→ hardcoded /data/*.ts ❌ │  │
│              │  /settings ────→ hardcoded / vacío    ❌ │  │
│              └──────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS + httpOnly cookie
                              │ Bearer JWT + X-Organization-Id
┌─────────────────────────────▼───────────────────────────────┐
│  Railway                                                    │
│  movos-api · NestJS 10 · /api/v1                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Guards: JwtAuthGuard → OrgContextGuard → RolesGuard │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  /auth         login, refresh, logout, me, select-org│  │
│  │  /organizations GET list                             │  │
│  │  /sites        CRUD + archive (OWNER/ADMIN)          │  │
│  │  /locations    autocomplete, place details           │  │
│  │  /health       GET                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Prisma 6.2 → PostgreSQL (Railway)                   │  │
│  │  Models: User, Organization, Membership,             │  │
│  │          Site, RefreshSession, AuditEvent            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │  Google Maps API    │
                   │  Places Autocomplete│
                   │  Place Details      │
                   └─────────────────────┘
```

---

## 4. Estado por Módulo

### 4.1 Autenticación (`auth`)

**Estado: ✅ Completo y en producción**

| Feature | Impl. |
|---|---|
| Login email + password (bcrypt) | ✅ |
| Access token (JWT, 15 min, en memoria) | ✅ |
| Refresh token (SHA-256 hash en DB, httpOnly cookie, 7 días) | ✅ |
| Refresh token rotation | ✅ |
| Logout con revocación | ✅ |
| GET /auth/me | ✅ |
| Selección de organización (emite JWT con orgId) | ✅ |
| Mensajes de error genéricos (no revela si email existe) | ✅ |
| Auditoría de LOGIN_SUCCEEDED / LOGIN_FAILED / LOGOUT | ✅ |
| Restauración automática de sesión en mount | ✅ |
| Redirect a /login en 401 | ✅ |
| Middleware de ruta (cookie `movos_session`) | ✅ |

**Gaps:**
- No existe registro (sign-up) — solo seed SQL
- No existe reset de contraseña
- No existe invitación de usuarios
- El org-switcher de la UI solo usa la primera organización (`organizations[0]`)
- No existe 2FA / MFA

### 4.2 Organizaciones (`organizations`)

**Estado: ✅ Básico implementado**

- `GET /organizations` — lista orgs del usuario autenticado
- No existe `POST /organizations` (creación solo vía seed)
- No existe `PATCH /organizations` (actualización)
- No existe gestión de membresías vía API

### 4.3 Sitios (`sites`)

**Estado: ✅ Completo — primer módulo EV funcional**

| Feature | Impl. |
|---|---|
| `GET /sites` — lista no-archivados | ✅ |
| `POST /sites` — crear (OWNER/ADMIN) | ✅ |
| `GET /sites/:id` — detalle con org-isolation | ✅ |
| `PATCH /sites/:id` — actualizar (OWNER/ADMIN/OPERATOR) | ✅ |
| `POST /sites/:id/archive` — archivar (OWNER/ADMIN) | ✅ |
| Slug único por organización | ✅ |
| 10 campos de ubicación enriquecida (Google) | ✅ |
| Auditoría SITE_CREATED / SITE_UPDATED / SITE_ARCHIVED | ✅ |
| UI — lista de sitios con cards | ✅ |
| UI — modal de creación con LocationPicker | ✅ |
| UI — página de detalle (`/sites/[siteId]`) | ✅ |

**Gaps:**
- No existe paginación en `GET /sites`
- No existe filtrado/búsqueda por nombre, ciudad, estado
- La página de detalle es de solo lectura (no tiene form de edición)
- No existe modal de confirmación para archivar
- `locationValidatedAt` nunca se popula

### 4.4 Localización (`location`)

**Estado: ✅ Completo**

- `GET /locations/autocomplete?input=&sessionToken=` — Google Places API
- `GET /locations/place/:placeId?sessionToken=` — Place Details con coordenadas
- Tipo sin restricción (establishments + addresses + geocodes)
- Restricción por país: `country:CO`

### 4.5 Cargadores (`chargers`)

**Estado: ❌ Solo demo**

- Página `/chargers` y `/chargers/[chargerId]` muestran datos de `src/data/chargers.ts`
- 6 cargadores hardcodeados (Kempower, ABB, Alpitronic)
- **No existe** modelo `Charger` en Prisma
- **No existe** endpoint `/api/v1/chargers`

### 4.6 Estaciones (`stations`)

**Estado: ❌ Solo demo**

- Página `/stations` muestra datos de `src/data/stations.ts`
- **No existe** modelo `Station` en Prisma
- **No existe** endpoint `/api/v1/stations`

### 4.7 Conectores (`connectors`)

**Estado: ❌ Solo demo**

- Página `/connectors` muestra datos de `src/data/connectors.ts`
- **No existe** modelo `Connector` en Prisma

### 4.8 Sesiones de carga (`sessions`)

**Estado: ❌ Solo demo**

- Páginas `/sessions` y `/sessions/[sessionId]` muestran datos de `src/data/sessions.ts`
- **No existe** modelo `ChargingSession` en Prisma
- **No existe** endpoint `/api/v1/sessions`

### 4.9 Usuarios (`users`)

**Estado: ❌ Solo demo — UI sin conexión a API**

- Página `/users` muestra datos de `src/data/users.ts`
- El modelo `User` y `Membership` **sí existen** en DB
- Pero no hay endpoint `GET /api/v1/users` para gestión de equipo

### 4.10 Tarifas (`tariffs`)

**Estado: ❌ Solo demo**

- Página `/tariffs` muestra datos de `src/data/tariffs.ts`
- **No existe** modelo `Tariff` en Prisma

### 4.11 Alertas (`alerts`)

**Estado: ❌ Solo demo**

- Página `/alerts` muestra datos de `src/data/alerts.ts`
- **No existe** modelo `Alert` en Prisma

### 4.12 Reportes (`reports`)

**Estado: ❌ Solo pantalla vacía / placeholder**

### 4.13 Dashboard

**Estado: ⚠️ Parcial — métricas hardcodeadas, vivo limitado**

- `_dashboard-live.tsx` potencialmente hace polling pero datos son de `src/data/dashboard.ts`
- Todas las métricas (sesiones activas, alertas, revenue, disponibilidad) son hardcodeadas
- El componente `pilotMilestones` y `networkDistribution` son estáticos

### 4.14 Configuración (`settings`)

**Estado: ❌ Stub — sin funcionalidad**

---

## 5. Estado de Multi-tenancy

**Estado: ✅ Correcto y completo**

El modelo de tenancy está bien implementado:

1. **`OrgContextGuard`** — ejecutado en cada request protected:
   - Lee `X-Organization-Id` del header (o `orgId` del JWT)
   - Valida `ACTIVE` membership en DB en cada request
   - Adjunta `membership` al request para handlers y guards downstream
   - Nunca confía en el header solo — siempre re-valida contra DB

2. **`SitesService`** — aplica `organizationId` en todas las queries:
   - `findFirst({ where: { id, organizationId } })` — isolation en get-by-id
   - Los sitios de otras organizaciones son indistinguibles de los inexistentes

3. **`RolesGuard`** — verifica `MemberRole` antes de mutaciones:
   - OWNER + ADMIN pueden crear/archivar sitios
   - OWNER + ADMIN + OPERATOR pueden actualizar sitios

4. **Audit log** — cada operación registra `organizationId` + `actorUserId`

**Gaps de multi-tenancy:**
- El org-switcher de la UI no está implementado — siempre usa `organizations[0]`
- No existe `PATCH /organizations/:id` para gestionar org desde la UI
- No existe gestión de membresías vía UI (invitar, suspender, cambiar rol)

---

## 6. Estado de Seguridad

### Implementado correctamente ✅

| Control | Implementación |
|---|---|
| Contraseñas | bcrypt (salt rounds default = 10) |
| Access token | JWT en memoria del cliente, nunca en localStorage |
| Refresh token | Opaque UUID, SHA-256 hash en DB, httpOnly cookie SameSite=Lax |
| Rotación de refresh | Token anterior revocado en cada refresh |
| Errores de login | Mensaje genérico, nunca revela si email existe |
| CORS | Configurado con lista de orígenes desde env |
| Validación de inputs | `ValidationPipe` whitelist + forbidNonWhitelisted |
| Google Maps keys | Server key en Railway env (no en código), Browser key en Vercel env |
| Secretos en código | Ninguno encontrado en código fuente |
| Prisma en DB | Credenciales solo en `DATABASE_URL` env var |

### Gaps de seguridad ⚠️

| Gap | Riesgo | Prioridad |
|---|---|---|
| No rate limiting en `/auth/login` | Brute force posible | ALTA |
| Middleware solo verifica cookie `movos_session`, no el JWT | Un usuario podría manipular la cookie de sesión en edge cases | MEDIA |
| `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` requeridos en env | Si se compromete la env de Railway, credenciales admin accesibles | MEDIA |
| No existe expiración de refresh sessions por inactividad | Sessions viven 7 días aunque el usuario no use la app | BAJA |
| Swagger expuesto en dev/staging sin auth | Documenta toda la API públicamente en entornos no-prod | BAJA |
| `.env` local en `apps/movos-api/` (no debería estar en el repo) | Confirmar está en `.gitignore` | BAJA |

---

## 7. Estado de Despliegue

### Producción actual

| Servicio | Plataforma | URL | Estado |
|---|---|---|---|
| `movos-api` | Railway | `movos-api-production.up.railway.app` | ✅ Online |
| `movos-web` | Vercel | `movos-web.vercel.app` | ✅ Ready |
| PostgreSQL | Railway | (managed, private) | ✅ Online |

### Deployment pipeline

| Paso | Estado |
|---|---|
| CI/CD automatizado | ❌ No existe |
| GitHub Actions | ❌ No existe `.github/workflows/` |
| Vercel GitHub integration | ⚠️ No auto-despliega — requiere `vercel --prod` manual |
| Railway GitHub integration | ⚠️ No auto-despliega — requiere `railway deployment up` manual |
| Migrations en deploy | ✅ `railway run prisma migrate deploy` en Railway |
| Environment secrets | ✅ En Railway y Vercel dashboards |

### Variables de entorno requeridas

**Railway (movos-api):**
```
DATABASE_URL                        # PostgreSQL connection string
JWT_ACCESS_SECRET                   # ≥32 chars
JWT_REFRESH_SECRET                  # ≥32 chars
JWT_ACCESS_TTL                      # default 900
JWT_REFRESH_TTL                     # default 604800
CORS_ORIGINS                        # https://movos-web.vercel.app
SEED_ADMIN_EMAIL                    # admin inicial
SEED_ADMIN_PASSWORD                 # admin inicial
MOVOS_GOOGLE_MAPS_SERVER_API_KEY    # Places API + Geocoding API
GOOGLE_MAPS_REGION                  # default CO
GOOGLE_MAPS_LANGUAGE                # default es
NODE_ENV                            # production
PORT                                # 4000
```

**Vercel (movos-web):**
```
NEXT_PUBLIC_MOVOS_API_URL                  # https://movos-api-production.up.railway.app
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY    # Maps JavaScript API (restricted)
```

---

## 8. Tests y Calidad de Código

### Resultados de QA (ejecutados 2026-07-19)

| Check | Resultado |
|---|---|
| `movos-api typecheck` | ✅ 0 errores |
| `movos-web typecheck` | ✅ 0 errores |
| `movos-api lint` | ✅ 0 warnings / 0 errores |
| `movos-web lint` | ✅ 0 warnings / 0 errores |
| `movos-api unit tests` | ✅ **35/35 PASS** (4 suites) |
| `movos-web tests` | ❌ No existen (`test` script no configurado) |

### Cobertura de tests (`movos-api`)

| Suite | Tests | Estado |
|---|---|---|
| `auth.service.spec.ts` | ~15 | ✅ PASS |
| `sites.service.spec.ts` | ~12 | ✅ PASS |
| `location.service.spec.ts` | ~6 | ✅ PASS |
| `sites/slugify.spec.ts` | 2 | ✅ PASS |
| `auth.e2e-spec.ts` | — | ⚠️ Solo existe el archivo, no se ejecutó (requiere DB real) |
| `tenant-isolation.e2e-spec.ts` | — | ⚠️ Solo existe el archivo, no se ejecutó |

### Issues de tests

- **Open handles warning**: worker process no sale limpiamente — probable leak de timer o conexión en teardown. Agregar `--forceExit` como workaround o cerrar `PrismaService` en `afterAll`.
- **Sin tests en movos-web**: 0 tests unitarios, 0 tests de componentes, 0 tests e2e para el frontend.
- **Tests e2e requieren DB**: los e2e specs (`auth.e2e-spec.ts`, `tenant-isolation.e2e-spec.ts`) necesitan una base de datos real — no se ejecutan en modo unitario.

---

## 9. Deuda Técnica Priorizada

### P1 — Bloqueador funcional (antes de CAP-001)

| ID | Deuda | Impacto |
|---|---|---|
| TD-01 | **No existen modelos Prisma para Charger, Station, Connector, ChargingSession, Tariff, Alert** | Sin estos modelos no es posible implementar ningún módulo EV real |
| TD-02 | **No existe CI/CD** — deployments son 100% manuales | Riesgo de romper producción en cualquier merge sin validación automática |
| TD-03 | **No existe rate limiting en `/auth/login`** | Vulnerabilidad de brute-force en producción |

### P2 — Deuda de calidad (bloquea escalabilidad)

| ID | Deuda | Impacto |
|---|---|---|
| TD-04 | `packages/core-domain` es un placeholder sin contenido | Impide modelar el dominio OCPP/EV de forma compartida |
| TD-05 | `packages/ui` compilado pero no importado en `movos-web` | Movos-web tiene sus propios componentes duplicados; no hay librería compartida real |
| TD-06 | Org-switcher de UI usa siempre `organizations[0]` | Usuarios con múltiples orgs no pueden cambiar de contexto |
| TD-07 | No existe paginación ni filtrado en `GET /sites` | Escala mal con volumen |
| TD-08 | 11 archivos `src/data/*.ts` con datos hardcodeados | Todo el demo data debe reemplazarse por APIs reales progresivamente |
| TD-09 | `locationValidatedAt` siempre null — campo nunca se popula | Lógica de validación de ubicación incompleta |

### P3 — Deuda operacional (antes de go-live real)

| ID | Deuda | Impacto |
|---|---|---|
| TD-10 | Sin monitoreo de errores (Sentry / Datadog) | Errores de producción son invisibles |
| TD-11 | pnpm 11.5.3 (latest 11.15.1) | Actualización pendiente |
| TD-12 | `.railwayignore` no está en el repositorio (untracked) | Si se pierde el archivo local, el próximo `railway deployment up` sube `node_modules` |
| TD-13 | Tests e2e no se ejecutan en pipeline | `auth.e2e-spec.ts` y `tenant-isolation.e2e-spec.ts` existen pero no tienen entorno de ejecución |
| TD-14 | `tenant.ts` hardcodea "Kylum Energy" | White-label incompleto — un segundo cliente requiere cambio en código |
| TD-15 | Seed solo vía `ts-node prisma/seed.ts` | No existe forma de crear usuarios/orgs desde UI |

---

## 10. Bloqueadores para CAP-001

Asumiendo que **CAP-001** es el módulo de gestión de activos de carga (Chargers Asset Provisioning), los bloqueadores son:

1. **No existen modelos en DB**: hay que agregar `Station`, `Charger`, `Connector` a `schema.prisma` y crear migraciones.
2. **No existe la API NestJS para estos recursos**: hay que crear módulos, servicios, controladores y DTOs para `stations` y `chargers`.
3. **No existe CI/CD**: cada cambio tiene que desplegarse manualmente — riesgo operacional mientras el equipo crece.
4. **No existe el endpoint `GET /users` para gestión de equipo**: si CAP-001 incluye asignar técnicos a estaciones, se necesita la API de usuarios.

---

## 11. Recomendaciones

### Inmediatas (antes de primer sprint de CAP-001)

1. **Agregar rate limiting** en `/auth/login` con `@nestjs/throttler` — ya está instalado pero no configurado por ruta.
2. **Comprometer `.railwayignore`** al repositorio (`git add .railwayignore`).
3. **Agregar `--forceExit`** al script `test` en `apps/movos-api/package.json` para eliminar el cuelgue de Jest.
4. **Crear `.github/workflows/ci.yml`** mínimo: typecheck + lint + test en cada PR.

### Para CAP-001

5. **Definir y aplicar migración Prisma** con los modelos `Station`, `Charger`, `Connector`.
6. **Crear módulos NestJS** con tenancy via `OrgContextGuard` para cada recurso.
7. **Reemplazar los archivos `src/data/chargers.ts`, `stations.ts`, `connectors.ts`** por llamadas reales a la API.
8. **Implementar paginación** desde el inicio en los nuevos endpoints (cursor-based o offset).

### Mediano plazo

9. **Implementar `packages/core-domain`** con tipos y value objects del dominio OCPP.
10. **Implementar `packages/ui`** o consolidar componentes de `movos-web` en él.
11. **Implementar org-switcher** en la UI para soportar múltiples tenants.
12. **Configurar Sentry** o equivalente en Railway y Vercel.

---

## 12. Propuesta para iniciar CAP-001

### Definición asumida de CAP-001
*Gestión de activos de carga: crear, listar, editar y desactivar Stations, Chargers y Connectors dentro de una organización.*

### Archivos a crear

**`apps/movos-api/prisma/`**
- `migrations/YYYYMMDD_add_ev_assets/migration.sql` — modelos Station, Charger, Connector

**`apps/movos-api/src/stations/`**
- `stations.module.ts`
- `stations.service.ts`
- `stations.service.spec.ts`
- `stations.controller.ts`
- `dto/create-station.dto.ts`
- `dto/update-station.dto.ts`

**`apps/movos-api/src/chargers/`**
- `chargers.module.ts`
- `chargers.service.ts`
- `chargers.service.spec.ts`
- `chargers.controller.ts`
- `dto/create-charger.dto.ts`
- `dto/update-charger.dto.ts`

**`packages/shared-types/src/movos-api.ts`** *(modificar)*
- Agregar `ApiStation`, `ApiCharger`, `ApiConnector`

### Archivos a modificar

**`apps/movos-api/prisma/schema.prisma`**
- Agregar modelos `Station`, `Charger`, `Connector` con relaciones a `Site` y `Organization`

**`apps/movos-api/src/app.module.ts`**
- Importar `StationsModule`, `ChargersModule`

**`apps/movos-web/app/(app)/stations/page.tsx`**
- Reemplazar import de `src/data/stations.ts` por llamada a `apiClient.get('/stations')`

**`apps/movos-web/app/(app)/chargers/page.tsx`**
- Reemplazar import de `src/data/chargers.ts` por llamada a `apiClient.get('/chargers')`

**`apps/movos-web/app/(app)/chargers/[chargerId]/page.tsx`**
- Reemplazar datos demo por `apiClient.get('/chargers/:id')`

---

## 13. Inventario de Archivos Demo a Reemplazar (en orden sugerido)

| Archivo | Módulo | Bloqueado por |
|---|---|---|
| `src/data/stations.ts` | Stations | Migración + API /stations |
| `src/data/chargers.ts` | Chargers | Migración + API /chargers |
| `src/data/connectors.ts` | Connectors | Migración + API /connectors |
| `src/data/sessions.ts` | Sessions | Modelo ChargingSession + OCPP |
| `src/data/users.ts` | Users | API /users (ya existe User en DB) |
| `src/data/tariffs.ts` | Tariffs | Modelo Tariff |
| `src/data/alerts.ts` | Alerts | Modelo Alert / sistema de eventos |
| `src/data/dashboard.ts` | Dashboard | Todos los módulos anteriores |
| `src/data/activity.ts` | Activity feed | AuditEvent API (ya existe en DB) |

---

## Apéndice — Resultados de QA

```
Date:    2026-07-19
Branch:  main
Commit:  de8f1f3

movos-api typecheck   → PASS (0 errors)
movos-web typecheck   → PASS (0 errors)
movos-api lint        → PASS (0 errors, 0 warnings)
movos-web lint        → PASS (0 errors, 0 warnings)
movos-api tests       → PASS  35/35 tests, 4 suites
                        ⚠ open handles warning (worker force-exited)
movos-web tests       → N/A  (no test script configured)
movos-web build       → PASS (last Vercel build: dpl_Gdn8SBZSTxcAjrn88TfqkqVaXjvV)
movos-api deploy      → PASS (Railway: 821b71df SUCCESS)
```
