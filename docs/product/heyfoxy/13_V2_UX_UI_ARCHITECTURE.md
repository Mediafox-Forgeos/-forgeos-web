# 13 — Hey Foxy V2: arquitectura UX/UI y propuesta de Work Orders

| Propiedad    | Valor                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Fecha        | 2026-11-14 (propuesta) · 2026-11-20 (decisiones de Álvaro y corrección)                                                       |
| Fuente       | [`design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md`](./design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md) v0.2 y `HEY_FOXY_V2_CONCEPT.png` |
| Base técnica | `apps/heyfoxy-web` en `1b74b7c`, desplegado en el Preview n.º 4                                                               |
| Estado       | **Plan aprobado (§0).** Autorizadas solo WO-HF-V2-DOC y WO-HF-V2-00; el resto, preparadas en [14](./14_V2_PHASE_PLAN.md)      |
| Alcance      | Solo QA (Preview). Sin Production, sin migraciones, sin Metricool ni WhatsApp                                                 |

## 0. Decisiones de Álvaro (2026-11-20)

| #   | Tema                  | Decisión                                                                                                                                                        |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gate D                | Debe cerrarse funcionalmente **antes** de la implementación visual general. Solo Álvaro lo declara cerrado                                                      |
| 2   | Navegación            | **Opción A:** `/` pasa a ser Intelligence Home e **integra el Resumen**. Sin pantallas duplicadas                                                               |
| 3   | QA                    | Aprobados Playwright y `@axe-core/playwright` como dependencias de desarrollo                                                                                   |
| 4   | Foxy                  | **Componente SVG original**; el PNG es referencia. Sin raster como sustituto permanente de la iconografía                                                       |
| 5   | Benchmark y Audiencia | «Próximamente» o «Sin datos disponibles». Sin métricas, publicaciones ni competidores inventados                                                                |
| 6   | Design System         | Versionado en una rama específica: `feat/heyfoxy-v2-uxui`                                                                                                       |
| 7   | Claro y oscuro        | Ambos sistemas de tokens; **adopción progresiva** por componente y pantalla, sin cambiar toda la app a claro de golpe                                           |
| 8   | Publicaciones reales  | Componentes listos para fotos, videos, carruseles, avatares y autores, métricas, comentarios vinculados y enlace original. Sin Metricool, sin medios inventados |
| 9   | Experiencia           | Principios del DS: inspiración Talkwalker/Emplifi, iconografía funcional, superficies por módulo, Foxy copiloto, responsive, WCAG AA                            |
| 10  | Seguridad             | Sin cambios en Supabase, migraciones, RLS, autenticación ni permisos; sin MediaFOX OS ni MOVOS; sin Production; sin WhatsApp ni Metricool reales                |
| —   | Despliegues           | Cualquier Preview requiere GO con el SHA exacto                                                                                                                 |

**Correcciones al diagnóstico del 14:**

- Los colores fijos no están solo en `ui.tsx` (21) e `insights.tsx` (6): hay **8 más** en `login/page.tsx` (4), `password-form.tsx`, `reset-request-form.tsx`, `nueva-clave/new-password-form.tsx` y `incidentes/[id]/transition-form.tsx`. WO-HF-V2-01 los incluye.
- Las herramientas de QA **no** van en `apps/heyfoxy-web`: `@playwright/test` es un peer opcional de `next`, y pnpm lo propagaba a la entrada de `next` de `forgeos-web`, `forge-labs` y `movos-web` en el lockfile raíz (y a su instalación). Viven en **`tools/heyfoxy-qa`**, fuera del workspace y con lockfile propio; el lockfile raíz no cambia.

## 1. Resumen ejecutivo

- **El rediseño es viable sin tocar la lógica.** La app ya separa datos (repositorios, RLS, server actions) de presentación.
  - Los colores fijos están concentrados en **2 archivos**: `components/ui.tsx` (21 clases) y `components/insights.tsx` (6).
  - Las páginas usan tokens semánticos (117 usos).
  - Cambiar los tokens y la biblioteca de componentes rediseña la mayor parte de la app sin modificar `actions.ts`, repositorios, sesión, middleware ni base de datos.
- **Cambio visual mayor:** de tema oscuro con acento naranja e Inter (sin cargar) a **tema claro primero con violeta `#6C35FF` y Nunito**, con modo oscuro por pares semánticos.
- **El concepto muestra capacidades que hoy no tienen datos:**
  - Share of Voice contra competidores, Audiencia, miniaturas reales de publicaciones, avatares y un canal WhatsApp en «Menciones por canal».
  - El propio DS exige no simularlas: se proponen **estados «No disponible / Sin base comparable»**, no cifras inventadas (§7).
- **Plan:** 9 Work Orders en 4 fases.
  - Cada una se despliega solo en Preview con un GO ligado al SHA, con smoke, aislamiento y accesibilidad automatizados.
  - **Rollback inmediato:** reasignar el alias `heyfoxy-qa-mediafox` al Preview anterior.

## 2. Decisiones vigentes que la V2 debe respetar

| Origen                | Decisión                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Gate 2                | **Sigue abierto** hasta la validación manual de Álvaro sobre el Preview n.º 4 (12 §7)                                  |
| Seguridad             | RLS y controles en servidor; la UI nunca es la barrera. Grants explícitos (0004), HF-SEC-03/04 (0005)                  |
| Datos                 | Sintéticos siempre identificados (`is_demo`, `is_synthetic`, `[SINTÉTICO]`); cobertura parcial declarada (requisito D) |
| Humano en el circuito | Revisión humana de alertas críticas antes de escalar; cierre de incidente con resumen; WhatsApp solo `simulate`        |
| Operación             | Sin `vercel curl` ni bypass (HF-OPS-09); despliegues solo con `deploy-preview.sh` y GO por SHA; Production congelado   |
| Credenciales          | No se leen ni se extraen contraseñas del llavero; el QA autenticado se hace en navegador asistido                      |

## 3. Diagnóstico de la arquitectura actual

| Capa        | Estado actual                                                                                                                             | Impacto V2                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Framework   | Next 15 App Router, Server Components; `(app)/layout.tsx` como shell                                                                      | Se mantiene                                                   |
| Datos       | `Repository` con implementaciones Demo y Supabase (sesión de usuario + RLS); `lib/insights.ts` para indicadores                           | Se mantiene. Ampliaciones **aditivas** (§9)                   |
| Acciones    | `app/actions.ts` (login, recuperación, revisión, incidentes, cambio de organización)                                                      | **Sin cambios**                                               |
| Tokens      | Variables HSL en `globals.css` (tema oscuro, `--brand` naranja); Tailwind 3 extiende `border/background/foreground/muted/card/brand/demo` | Se sustituyen por tokens V2 light/dark                        |
| Tipografía  | `Inter` en `font-family`, sin cargar (cae a la fuente del sistema)                                                                        | Nunito con `next/font`, autoalojada en el build               |
| Componentes | `components/ui.tsx` (Card, PageHeader, Badge×4, Stat, EmptyState, CoverageNotice, DemoBanner, buttonCls), `item-card.tsx`, `insights.tsx` | Evolucionan a la biblioteca V2 (§5)                           |
| Gráficos    | Barras CSS hechas a mano (sentimiento por día); sin librería                                                                              | Primitivas SVG propias y accesibles (§6)                      |
| Iconos      | `lucide-react` 0.468                                                                                                                      | Se mantiene. Se añaden iconos de redes (§6)                   |
| Navegación  | Sidebar con 3 grupos y 12 vistas; selector de organización por `hf_org`; móvil con `<details>`                                            | AppShell V2 (§4)                                              |
| Pruebas     | 60 unitarias, 122 SQL, smoke HTTP 40/40 (demo), contrato 36/36                                                                            | Se conservan; se suman accesibilidad y regresión visual (§10) |

## 4. Arquitectura de experiencia y navegación

**Principio:** las URL actuales no cambian, para conservar enlaces, smoke tests y la validación de Gate D. Los 5 espacios del DS se mapean así:

| Espacio DS             | Rutas                                                      | Cambio principal                                                                                                   |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 01 Intelligence Home   | `/`                                                        | Hoy es el «Resumen». Pasa a ser Home: pulso, KPI, tendencia, señales, publicaciones relevantes y hallazgos de Foxy |
| 02 Social Explorer     | `/publicaciones`, `/publicaciones/[id]`                    | De lista a galería de tarjetas; el detalle se abre en panel lateral y conserva la URL propia                       |
| 03 Conversation Studio | `/conversaciones`                                          | Tres columnas: bandeja priorizada, hilo con publicación original, y Foxy con acciones. Incluye menciones           |
| 04 Reputation War Room | `/alertas`, `/revision`, `/incidentes`, `/incidentes/[id]` | Tarjetas de alerta con evidencia; workspace de incidente con timeline, responsable, notas y tiempo transcurrido    |
| 05 Insights & Reports  | `/reportes` (+ `/temas`)                                   | Pestañas: Visión general, Temas y tendencias, Reportes. Benchmark y Audiencia aparecen como «No disponible»        |
| Plataforma             | `/cobertura`, `/whatsapp`, `/uso`, `/configuracion`        | Solo reestilizado                                                                                                  |

**AppShell:**

- **Sidebar** de 224–256 px con los grupos del concepto, contador de alertas pendientes y tarjeta de usuario (nombre y rol).
- **Cabecera:**
  - selector de periodo (`?periodo=7d|30d|90d`, que se conserva al profundizar);
  - buscador global sobre conversaciones y publicaciones con `items({ q })` y `posts({ q })`;
  - acceso a alertas y Foxy.
- **Tablet:** sidebar compacta de solo iconos con tooltip.
- **Móvil:** una columna y navegación por niveles. El panel contextual pasa a una hoja inferior.

**Decidido (opción A):** el concepto muestra a la vez «Inicio» y «Resumen». `/` es Intelligence Home y **absorbe el contenido del Resumen** (KPI, sentimiento, temas, alertas prioritarias); la entrada «Resumen» desaparece de la navegación. Sin pantallas duplicadas.

## 5. Biblioteca de componentes (`components/ds/`)

Componentes de presentación sin acceso a datos: reciben props tipadas con los tipos de `lib/types.ts` y `lib/insights.ts`. Cada componente tiene sus estados: default, hover, focus, loading, empty, error, disabled y permission.

| #   | Componente                                                                                                                                                                             | Reemplaza o evoluciona                | Notas                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `AppShell`, `Sidebar`, `TopBar`, `OrgSwitcher`, `PeriodPicker`, `UserCard`                                                                                                             | `(app)/layout.tsx`, `nav.tsx`         | `OrgSwitcher` sigue usando la server action `switchOrg` (validada contra las membresías)                                       |
| 2   | `PageHeader` v2 (eyebrow de módulo, título, descripción, acciones)                                                                                                                     | `PageHeader`                          | Conserva `layer` (operativa o reputacional) como eyebrow                                                                       |
| 3   | `KpiCard` (valor, unidad, periodo, delta, comparabilidad, icono con fondo tonal)                                                                                                       | `Stat`                                | Muestra «Sin base comparable» si el periodo base es 0 (regla del DS)                                                           |
| 4   | `ChartCard` (título, explicación, leyenda, tabla accesible, enlace a la evidencia)                                                                                                     | Cards con gráficos                    | Envoltorio de las primitivas del §6                                                                                            |
| 5   | `SocialPostCard` (red, cuenta, miniatura o fallback, métricas, cobertura, comentarios, enlace original)                                                                                | Filas de `/publicaciones`             | Medio solo si existe y está permitido; si no, el icono de la red y el enlace                                                   |
| 6   | `ConversationRow` (iniciales o red, extracto, sentimiento, intención, gravedad, prioridad, estado)                                                                                     | `ItemCard`                            | Sin avatares reales: `author_hash` minimiza PII                                                                                |
| 7   | `FoxyInsightPanel` (hallazgo, evidencia citada, confianza, limitaciones, acción propuesta y confirmación)                                                                              | Nuevo                                 | Hallazgos por **reglas** sobre `lib/insights` (sin LLM nuevo). Etiqueta «Generado por reglas». Ninguna acción sin confirmación |
| 8   | `AlertCard` (severidad, estado, razón, fuente, evidencia, confirmar o descartar con motivo)                                                                                            | `alert-card.tsx`                      | El motivo del descarte se registra en `audit_logs` (`authenticated` ya puede insertar; sin migración)                          |
| 9   | `IncidentWorkspace` (timeline, asignación, notas, tiempo abierto, resolución, auditoría)                                                                                               | `/incidentes/[id]`                    | SLA: solo tiempo transcurrido. No existe columna de SLA (no se inventa)                                                        |
| 10  | `CoverageBanner` (conectadas, ausentes, permisos, retrasos, alcance de las conclusiones)                                                                                               | `CoverageNotice`                      | Misma fuente: `summarizeCoverage`                                                                                              |
| 11  | `ReportComposer` (periodo, filtros, comparadores, resumen, evidencia, exportar)                                                                                                        | `/reportes`                           | Exportación a PDF diferida (CSS de impresión en la fase 4)                                                                     |
| 12  | `EmptyState`, `LoadingState`, `ErrorState`, `PermissionState`, `NotAvailableState`                                                                                                     | `EmptyState`, `ErrorNote`             | `NotAvailableState` cubre Benchmark, Audiencia y miniaturas                                                                    |
| 13  | Primitivas: `Button` (primary, secondary, ghost, danger), `Tabs`, `Chip`, `Toggle`, `Checkbox`, `Tooltip`, `Badge`/`StatusPill`, `SyntheticBadge`, `NetworkIcon`, `Avatar` (iniciales) | `buttonCls`, `Badge*`, `SyntheticTag` | Estados no solo por color: icono más texto                                                                                     |

**Catálogo interno:** `/_ds`, una página de componentes y variantes. Solo existe en modo demo (sin Supabase) y nunca en Production.

## 6. Tokens, tipografía, gráficos e iconografía

**Tokens** como variables CSS semánticas en `:root` (claro) y `[data-theme=dark]` / `prefers-color-scheme` (oscuro). Tailwind los expone con los nombres actuales (`background`, `card`, `muted`, `brand`, `border`…) para que las páginas no cambien.

| Token DS                      | Claro                 | Contraste medido                                                      | Ajuste propuesto                                                                                                                          |
| ----------------------------- | --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| brand.primary                 | `#6C35FF`             | Blanco sobre él 5,85:1 ✓; sobre tarjeta 5,85:1 ✓; sobre pale 4,87:1 ✓ | —                                                                                                                                         |
| brand.secondary               | `#9A6CFF`             | 3,52:1: **solo** gradientes y énfasis, nunca texto normal             | Restringir su uso                                                                                                                         |
| text.primary / text.secondary | `#14152E` / `#626781` | 17,09:1 / 5,33:1 sobre surface.base ✓                                 | —                                                                                                                                         |
| border.subtle                 | `#E3E7F2`             | 1,24:1: válido solo para bordes decorativos                           | **Nuevo `border.control` `#7E849E` (3,70:1)** para inputs y controles (WCAG 1.4.11)                                                       |
| status.\*.bg                  | Del DS                | Fondos                                                                | **Nuevos tokens de texto:** éxito `#0F7A4A` (4,93:1), info `#1D5FA8` (5,73:1), advertencia `#8A5A00` (5,56:1), crítico `#B4233C` (5,70:1) |
| Modo oscuro                   | —                     | —                                                                     | Pares definidos a mano, sin inversión automática. Validar contraste en la fase 1                                                          |

- **Tipografía:**
  - Nunito (400/600/700/800/900) con `next/font/google`, autoalojada en el build, sin peticiones a Google en runtime;
  - escala del DS; `font-variant-numeric: tabular-nums` en KPI y tablas.
- **Geometría:** escala de 4 px; radios de 10 px en controles, 16 px en tarjetas y 20–24 px en paneles destacados; sombras muy suaves; animaciones de 120–220 ms con `prefers-reduced-motion`.
- **Gráficos:** **primitivas SVG propias**, renderizadas en el servidor:
  - `AreaTrend` (línea o área con punto destacado), `Donut` (sentimiento), `BarList` (temas, canales, cobertura), `StackedBars` (sentimiento por día) y `Sparkline`;
  - cada una con `<table>` alternativa accesible y `aria-label`.
  - **No se recomienda Recharts ni Chart.js:** añadirían JS de cliente y dependencias para gráficos simples, y complicarían el renderizado en servidor y la accesibilidad.
- **Iconos:**
  - `lucide-react` con trazo 1.75–2 y tamaños 16/20/24, según el mapeo del DS: house, chart, images, messages-square, bell-ring, shield-alert, chart-no-axes-combined, sparkles, settings;
  - **iconos de redes** como SVG en línea de Simple Icons (CC0), usados para identificar la red según sus guías de marca, sin modificar los logotipos.
- **Mascota «Foxy»:** **componente SVG original** (`FoxyMark`, variantes `mark`, `avatar`, `illustration`) con colores de tokens. El PNG del concepto es solo referencia; no se usan imágenes rasterizadas como sustituto permanente (decisión 4).

## 7. Veracidad de datos: concepto frente a datos reales

| Elemento del concepto                | ¿Hay datos?                                                            | Tratamiento V2                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Alcance total, interacciones         | Sí (`post_metric_snapshots`; sintéticos en QA)                         | `KpiCard` con delta solo si hay base comparable                                                                                   |
| % positivas, neutrales y negativas   | Sí (`sentiment_analyses`)                                              | `Donut` y KPI                                                                                                                     |
| Evolución de la conversación         | Sí (`lib/insights.dailySentiment`)                                     | `AreaTrend`                                                                                                                       |
| Temas principales                    | Sí (`topTopics`)                                                       | `BarList`                                                                                                                         |
| Menciones por canal                  | Parcial: `social_mentions` existe pero el repositorio aún no lo expone | Ampliación aditiva del repositorio (WO-V2-07). **WhatsApp no es un canal de escucha**: no aparece en esta métrica                 |
| Share of Voice frente a competidores | **No** (no hay fuentes de competidores)                                | `NotAvailableState`: «Requiere fuentes de perfiles públicos autorizadas»                                                          |
| Audiencia                            | **No**                                                                 | `NotAvailableState`                                                                                                               |
| Miniaturas y medios de publicaciones | **No** (no hay columna de medio; depende de la API y los permisos)     | Fallback con icono de la red y enlace. Una columna `media_url` requeriría una **migración con GO aparte**                         |
| Avatares de autores                  | **No** (`author_hash` por minimización de PII)                         | Iniciales o icono de la red                                                                                                       |
| Hallazgos de «Foxy IA»               | No hay modelo conectado (proveedor `heuristic`)                        | Reglas deterministas sobre los indicadores, con evidencia y la etiqueta «Generado por reglas». La IA real requiere su propio gate |
| SLA de incidentes                    | No (sin columna)                                                       | Tiempo abierto y tiempo hasta el cierre; SLA configurable en el futuro                                                            |

## 8. Lógica que se conserva (sin cambios)

`app/actions.ts`, `lib/auth/session.ts`, `middleware.ts`, `app/auth/callback`, `lib/data/*` (solo ampliaciones aditivas), `lib/incidents/fsm.ts`, `lib/insights.ts` (solo funciones nuevas), migraciones, seed, RLS, grants y contrato.

**Regla de revisión:** las Work Orders de UI no pueden modificar estos archivos salvo para ampliaciones aditivas, declaradas y probadas. Se verifica en cada PR con `git diff --stat`.

## 9. Ampliaciones aditivas previstas (sin migraciones)

- `Repository.mentions(orgId, f)`, o `items()` con `kind: 'mention'`, en ambas implementaciones. Lo usan Conversation Studio y Menciones por canal.
- `lib/insights.ts`:
  - `comparable` en `PeriodTrend`: no mostrar el delta si `previous.total === 0`;
  - `channelBreakdown` (volumen por red);
  - `foxyFindings` (reglas: picos de volumen, aumento de % negativo, temas en alza; cada hallazgo cita los ids de la evidencia).
- Motivo del descarte de alertas: `audit_logs` (`action = 'alert.dismissed'`, `metadata.reason`), insertado por `authenticated` como sí mismo, tal como ya permite la política.

## 10. Plan por fases y Work Orders

Cada WO se desarrolla en local, se prueba y se publica en la rama.

- **Despliegue:** solo con un GO por SHA mediante `deploy-preview.sh`. El alias de QA apunta al nuevo Preview.
- **Rollback:** reasignar el alias al Preview anterior; es inmediato y sin datos.
- **Base de pruebas común a todas las WO** (deben seguir en verde):
  - typecheck y lint;
  - pruebas unitarias;
  - batería SQL 122/122 y contrato 36/36 (sin cambios de esquema);
  - smoke HTTP en demo, que se amplía con cada vista;
  - build en modo demo y en modo Supabase;
  - aislamiento por URL directa y por cookie forjada.

| Fase | WO                                                  | Alcance                                                                                                                                                                                                  | Criterios de aceptación                                                                                                                                  |
| ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | **WO-HF-V2-00** Herramientas de QA                  | Playwright y `@axe-core/playwright` como devDependencies, solo en local y en modo demo: capturas de 390, 820 y 1440 px y auditoría de accesibilidad de cada vista                                        | 0 violaciones axe «serious» o «critical» en la línea base actual (o lista de deuda acordada); capturas de referencia versionadas                         |
| 1    | **WO-HF-V2-01** Fundaciones                         | Tokens claro y oscuro (§6) con `border.control` y los textos de estado; Nunito; escala, radios y sombras; foco visible; movimiento reducido. Re-tematiza `ui.tsx` e `insights.tsx` **sin tocar páginas** | Todas las vistas 200; contraste AA verificado por script; diff limitado a estilos y componentes; smoke y axe en verde                                    |
| 1    | **WO-HF-V2-02** Biblioteca y gráficos               | `components/ds/*` (§5) y primitivas SVG con tabla accesible; catálogo `/_ds` solo en demo                                                                                                                | Pruebas de render de cada variante; tablas alternativas presentes; `/_ds` devuelve 404 en modo Supabase                                                  |
| 2    | **WO-HF-V2-03** AppShell y navegación               | Sidebar, TopBar, OrgSwitcher (misma action), PeriodPicker con `?periodo` que se conserva al profundizar, buscador global, UserCard, navegación móvil y tablet                                            | Las 12 rutas accesibles por teclado; el periodo se conserva entre vistas; el cambio de organización forjado sigue sin efecto; 390 y 820 px sin desbordes |
| 2    | **WO-HF-V2-04** Intelligence Home                   | `/`: KPI con comparabilidad, AreaTrend, Donut, señales, publicaciones relevantes y FoxyInsightPanel por reglas                                                                                           | Cifras idénticas a las de `lib/insights` para los mismos datos (prueba unitaria); «Sin base comparable» cuando corresponde; banda sintética visible      |
| 3    | **WO-HF-V2-05** Insights & Reports                  | `/reportes` con pestañas; Benchmark y Audiencia como «No disponible»; CSS de impresión                                                                                                                   | Ningún dato no disponible aparece como real; cobertura y resúmenes diarios intactos                                                                      |
| 3    | **WO-HF-V2-06** Social Explorer                     | Galería con `SocialPostCard`, filtros, panel lateral de detalle (con ruta propia), fallback de medios                                                                                                    | URL directa a una publicación ajena → 404; filtros en la URL                                                                                             |
| 3    | **WO-HF-V2-07** Conversation Studio                 | Tres columnas; incluye menciones (ampliación aditiva del repositorio); acciones solo según el rol                                                                                                        | El viewer no ve acciones; las menciones de otra organización no aparecen; la prueba SQL sigue 122/122                                                    |
| 3    | **WO-HF-V2-08** Reputation War Room                 | AlertCard con evidencia y descarte con motivo (en `audit_logs`), IncidentWorkspace con timeline                                                                                                          | La FSM, el cierre con resumen y la revisión humana funcionan igual; el motivo queda auditado con actor y fecha                                           |
| 4    | **WO-HF-V2-09** Accesibilidad, modo oscuro y cierre | Auditoría WCAG AA completa, navegación por teclado, modo oscuro, capturas finales, documentación y validación manual de Álvaro con los 6 perfiles (guion 12 §7 actualizado)                              | axe sin violaciones graves; capturas aprobadas; Gate de V2 cerrado por Álvaro                                                                            |

**Detalle de cada WO preparada (alcance, archivos, pruebas, rollback):** [14 — Plan por fases](./14_V2_PHASE_PLAN.md). WO-HF-V2-00 está **hecha** (WORKLOG 2026-11-20).

**Secuencia aprobada:** cerrar primero **Gate D** (validación manual del Preview n.º 4) para tener una línea base funcional. Después, fase 0 y fase 1. Si no, una regresión funcional y un cambio visual se confundirían.

## 11. Riesgos

| Riesgo                                                                                             | Mitigación                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| El concepto promete capacidades sin datos (Share of Voice, Audiencia, medios, WhatsApp como canal) | §7: estados «No disponible» explícitos; nada simulado como real                                                                              |
| Regresión funcional escondida en un cambio visual                                                  | Lógica congelada (§8); smoke, aislamiento y 122 SQL en cada WO; capturas y axe                                                               |
| Contraste insuficiente (brand.secondary, border.subtle)                                            | Tokens corregidos (§6) y verificación automática                                                                                             |
| La mascota no tiene licencia definida                                                              | Asset aportado por diseño; marcador mientras tanto                                                                                           |
| Dependencias nuevas                                                                                | Solo Playwright y axe como devDependencies; gráficos sin librería; Nunito autoalojada                                                        |
| El DS pide prototipos antes de programar                                                           | Las fases 0–1 (tokens, biblioteca y catálogo) **son** el prototipo navegable en QA; las vistas (fases 2–3) arrancan tras revisar el catálogo |

## 12. Decisiones de Álvaro

Resueltas el 2026-11-20 (§0). Lista original, para trazabilidad:

1. Aprobar el plan y el orden (Gate D primero → fase 0 → fase 1).
2. Home y Resumen: opción A (recomendada) o B (§4).
3. Aprobar las devDependencies de QA: Playwright y `@axe-core/playwright`.
4. Confirmar que la mascota y las ilustraciones las aporta diseño, y en qué formato.
5. Confirmar el tratamiento «No disponible» para Benchmark, Audiencia y miniaturas en esta versión.
6. Versionar en Git `design-system/` (incluido el PNG de 1,8 MB) junto a este informe.
