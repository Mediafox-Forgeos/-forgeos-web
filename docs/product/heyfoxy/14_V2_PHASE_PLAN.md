# 14 — Hey Foxy V2: plan detallado por fases

| Propiedad    | Valor                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha        | 2026-11-20                                                                                                                                    |
| Rama         | `feat/heyfoxy-v2-uxui` (desde `6ac992f` de `feat/heyfoxy-gate2-foundation`)                                                                   |
| Base         | [13 — Arquitectura UX/UI](./13_V2_UX_UI_ARCHITECTURE.md) (§0 decisiones) y [Design System v0.2](./design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md) |
| Estado       | **WO-HF-V2-DOC y WO-HF-V2-00 hechas.** WO-HF-V2-01 a 09 **preparadas, no autorizadas**                                                        |
| Precondición | **Gate D cerrado por Álvaro** antes de WO-HF-V2-01 (implementación visual general)                                                            |

## 1. Reglas comunes a todas las WO

**Fuera de alcance siempre:** Supabase (proyectos, Auth, migraciones, RLS, grants, seed), MediaFOX OS, MOVOS, Production, Metricool real, WhatsApp real, `vercel curl`.

**Archivos congelados** (solo ampliaciones aditivas, declaradas y probadas): `app/actions.ts`, `lib/auth/session.ts`, `middleware.ts`, `app/auth/callback/*`, `lib/data/*`, `lib/incidents/fsm.ts`, `lib/insights.ts`, `supabase/**`, `tests/sql/**`. Se verifica con `git diff --stat` en cada PR.

**Batería de cada WO** (todas en verde antes de pedir GO):

| Prueba                       | Comando                                                 | Línea base (2026-11-20)            |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------- |
| Typecheck y lint             | `tsc --noEmit`, `eslint .` en `apps/heyfoxy-web`        | Verde                              |
| Unitarias                    | `vitest run`                                            | 60/60                              |
| SQL local (Postgres efímero) | `scripts/test-db.sh`                                    | 122/122 y contrato OK              |
| Build                        | modo demo y modo Supabase (valores de relleno, sin red) | Verde, `check-trace` OK            |
| Smoke HTTP (demo)            | `scripts/smoke-http.sh`                                 | 40/40                              |
| QA visual, axe y funcional   | `tools/heyfoxy-qa` (`playwright test`)                  | 48/48; deuda: 2 reglas graves (§2) |

**Cambios visuales intencionados:** en cada WO, `playwright test` falla en las vistas tocadas (es lo esperado). Se revisan las diferencias en el informe HTML, se regraba con `e2e:record` y las capturas nuevas se versionan **en el mismo commit** de la WO. La deuda de axe solo puede **bajar**; una regla grave nueva bloquea la WO.

**Despliegue y rollback:** sin despliegue hasta el GO de Álvaro con el SHA exacto. Despliegue con `deploy-preview.sh`; el alias `heyfoxy-qa-mediafox` pasa al nuevo Preview. Rollback: reasignar el alias al Preview anterior (inmediato, sin datos).

## 2. Línea base registrada (WO-HF-V2-00)

- **Capturas:** 16 vistas × 3 viewports (390, 820, 1440) en `tools/heyfoxy-qa/baseline/screenshots/`, con el reloj del servidor fijado en `2026-11-14T15:00Z`. Estables entre ejecuciones (2 corridas consecutivas, 0 diferencias).
- **Accesibilidad (axe, WCAG 2.0/2.1/2.2 A y AA):** 0 críticas; 2 reglas «serious» como deuda conocida en `baseline/known-debt.json`:
  - `link-in-text-block` en 18 vistas (enlaces naranjas dentro de texto sin subrayado ni contraste 3:1 con el texto): Resumen, Alertas, Conversaciones, Publicaciones, Reportes y Temas, en los 3 viewports. Se corrige en WO-HF-V2-01 (enlaces con subrayado).
  - `scrollable-region-focusable` en 4 vistas (tablas con scroll horizontal no enfocables): Cobertura (390, 820), Publicación (390) y WhatsApp (390). Se corrige en WO-HF-V2-02 (contenedor de tabla con `tabIndex=0` y etiqueta).
- **Funcional:** las 16 vistas responden 200 con el owner demo, sin errores de consola ni excepciones, con un `<h1>`, y sin desbordamiento horizontal en ningún viewport.
- **Hallazgos fuera de axe:** falta `/favicon.ico` (HF-UX-02, WO-HF-V2-01); el seed demo muestra «Asignado a Asignado» en el historial del incidente (HF-UX-03).

## 3. Mecanismo de adopción progresiva de temas (decisión 7)

1. **Tokens:** `globals.css` define tres juegos de variables con los **mismos nombres** que hoy usa Tailwind (`--background`, `--card`, `--muted`, `--brand`, `--border`…) más los nuevos (`--surface-base`, `--text-secondary`, `--border-control`, `--status-*-bg/fg`, `--module-*`):
   - `:root` → **legado oscuro** (valores actuales, sin cambios visuales);
   - `[data-theme='v2-light']` y `[data-theme='v2-dark']` → V2.
2. **Ámbito:** cada vista migrada envuelve su contenido en `<V2Scope>`, que pone `data-theme` según la preferencia. Una vista **no migrada** ignora la preferencia y se ve igual que hoy.
3. **Preferencia de QA:** cookie `hf_ui` (`legacy` | `v2-light` | `v2-dark`), seleccionable en Configuración y en `/_ds`. **Valor por defecto: `legacy`**, así el Preview no cambia para nadie hasta que Álvaro lo decida (decisión pendiente D-1).
4. **Fin de la transición (WO-HF-V2-09):** cuando todas las vistas estén migradas y validadas, el por defecto pasa a `v2-light` (o al tema del sistema) y se retira `legacy`.

## 4. Work Orders preparadas

### WO-HF-V2-01 · Fundaciones (tokens, tipografía, base accesible)

- **Objetivo:** dejar listos los dos temas V2 sin cambiar la apariencia por defecto.
- **Alcance:**
  - Tokens de §3 en `globals.css` y `tailwind.config.ts` (claro y oscuro V2; legado intacto). Script `scripts/check-contrast.mjs` que mide cada par texto/fondo y control/fondo de ambos temas (≥ 4,5:1 texto, ≥ 3:1 controles y texto grande).
  - Nunito con `next/font/google` (autoalojada en el build), aplicada **solo** dentro de `V2Scope`; el legado conserva su fuente para no cambiar capturas.
  - Escala de espaciado, radios (10/16/20–24), sombras, foco visible y `prefers-reduced-motion` como utilidades.
  - Retirar los **35 colores fijos** (`ui.tsx` 21, `insights.tsx` 6, login y formularios 8) en favor de tokens, con el mismo aspecto en `legacy`.
  - Enlaces en texto con subrayado (cierra `link-in-text-block`); `app/icon.svg` provisional desde `FoxyMark` (cierra HF-UX-02).
  - `V2Scope` y cookie `hf_ui` (lectura en servidor, valor validado contra la lista; cualquier otro valor → `legacy`).
- **Pruebas nuevas:** contraste por script; unitaria de la validación de `hf_ui`; en `tools/heyfoxy-qa`, un proyecto adicional con `hf_ui=v2-light` sobre las vistas de autenticación.
- **Aceptación:** en `legacy`, las capturas solo cambian por el subrayado de enlaces; deuda axe ≤ 1 regla grave; contraste AA en ambos temas V2; batería completa en verde.

### WO-HF-V2-02 · Biblioteca de componentes y gráficos

- **Alcance:** `components/ds/*` con todos los componentes del DS §Componentes, incluidos:
  - **Medios (decisión 8):** `PostMedia` (`image` | `video` | `carousel`), `AuthorChip`, `PostMetrics`, `LinkedComments`, `OriginalLink`. Tipos de vista propios (`PostMediaView`, `AuthorView`) en `components/ds/types.ts`, **sin tocar** `lib/types.ts` ni el esquema; hoy siempre reciben `null` y muestran el fallback.
  - **Estados:** `EmptyState`, `LoadingState`, `ErrorState`, `PermissionState`, `NotAvailableState` («Sin datos disponibles»), `ComingSoonState` («Próximamente»).
  - **Foxy:** `FoxyMark` (SVG original; variantes `mark`, `avatar`, `illustration`; colores de tokens) y `FoxyInsightPanel`.
  - **Gráficos SVG de servidor:** `AreaTrend`, `Donut`, `BarList`, `StackedBars`, `Sparkline`, cada uno con `<table>` alternativa y `aria-label`.
  - Contenedor de tabla con scroll enfocable (cierra `scrollable-region-focusable`).
  - Iconos de redes (Simple Icons, CC0) en `components/ds/network-icons.tsx`.
- **Catálogo `/_ds`:** solo en modo demo; 404 en modo Supabase y en cualquier build con `VERCEL_ENV=production`. Cada componente en sus variantes y en los tres temas.
- **Pruebas:** render en servidor de cada variante (vitest + `react-dom/server`): tablas alternativas presentes, fallbacks sin `<img>` cuando no hay medio, `alt` obligatorio cuando lo hay. Capturas y axe de `/_ds` en los tres temas.
- **Aceptación:** deuda axe = 0 reglas graves; `/_ds` → 404 en modo Supabase (smoke nuevo); **revisión visual de Álvaro del catálogo** antes de empezar la fase 2.

### WO-HF-V2-03 · AppShell y navegación

- **Alcance:** `Sidebar` (grupos del concepto, contador de alertas pendientes, `UserCard`), `TopBar` (`PeriodPicker`, buscador global, acceso a alertas y a Foxy), `OrgSwitcher` (**misma** server action `switchOrg`), tablet con iconos y tooltip, móvil con navegación por niveles y hoja inferior.
  - **Navegación (decisión 2):** se retira «Resumen»; «Inicio» → `/`.
  - `?periodo=7d|30d|90d` se conserva al navegar y al profundizar (helper de enlaces).
  - Buscador: `items({ q })` y `posts({ q })` existentes, sin cambios en el repositorio.
- **Aceptación:** las rutas accesibles por teclado (orden de foco, `skip link`); el periodo se conserva; la cookie de organización forjada sigue sin efecto (smoke); 390 y 820 px sin desbordes; el shell legado se mantiene con `hf_ui=legacy`.

### WO-HF-V2-04 · Intelligence Home (integra el Resumen)

- **Alcance:** `/` con saludo y `FoxyMark`, KPI con comparabilidad, `AreaTrend`, `Donut`, señales emergentes, publicaciones relevantes (con `PostMedia` en fallback), alertas prioritarias y `FoxyInsightPanel` por reglas.
  - Ampliaciones aditivas en `lib/insights.ts`: `comparable` en `PeriodTrend`, `channelBreakdown`, `foxyFindings` (cada hallazgo cita ids de evidencia; etiqueta «Generado por reglas»).
  - Todo lo que mostraba el Resumen sigue presente (cobertura parcial, banda DEMO, alertas por revisar, incidentes activos): el smoke actual de `/` no cambia.
- **Aceptación:** cifras idénticas a `lib/insights` para los mismos datos (unitaria); «Sin base comparable» cuando corresponde; ningún hallazgo sin evidencia citada.

### WO-HF-V2-05 · Insights & Reports

- **Alcance:** `/reportes` con pestañas Visión general, Temas y tendencias, Reportes; **Benchmark** y **Audiencia** con `ComingSoonState` / `NotAvailableState` (decisión 5); `/temas` integrado como pestaña conservando su URL; CSS de impresión.
- **Aceptación:** ningún competidor, métrica ni publicación inventados (prueba de contenido); cobertura y resúmenes diarios intactos.

### WO-HF-V2-06 · Social Explorer

- **Alcance:** galería con `SocialPostCard` + `PostMedia` (fallback hoy), `AuthorChip`, `PostMetrics`, `LinkedComments`, `OriginalLink`; filtros en la URL; detalle en panel lateral que conserva `/publicaciones/[id]`.
- **Aceptación:** URL directa a una publicación de otra organización → 404 (smoke actual); con medio ausente no se renderiza ninguna imagen inventada; enlace original con `rel="noopener noreferrer"`.

### WO-HF-V2-07 · Conversation Studio

- **Alcance:** tres columnas (bandeja priorizada | hilo con publicación original | Foxy y acciones); menciones mediante una ampliación **aditiva** de `Repository` (`mentions()` o `items({ kind: 'mention' })`) en ambas implementaciones, sobre tablas y políticas existentes; acciones según el rol.
- **Aceptación:** el viewer no ve acciones; las menciones de otra organización no aparecen (prueba en modo demo y consulta con identidad QA solo lectura si Álvaro da GO); SQL 122/122 sin cambios.

### WO-HF-V2-08 · Reputation War Room

- **Alcance:** `AlertCard` con evidencia y descarte con motivo (registrado en `audit_logs` con `action = 'alert.dismissed'`, permitido hoy a `authenticated` sin migración); `IncidentWorkspace` con timeline, asignación, notas y tiempo abierto (sin SLA inventado).
- **Aceptación:** la FSM, el cierre con resumen y la revisión humana se comportan igual (unitarias existentes); el motivo queda auditado con actor y fecha.

### WO-HF-V2-09 · Accesibilidad, modo oscuro y cierre

- **Alcance:** auditoría WCAG 2.2 AA completa (axe + revisión manual de teclado y lector de pantalla), pulido de `v2-dark`, cambio del tema por defecto (D-1), retirada de `legacy`, capturas finales, documentación y validación manual de Álvaro con los 6 perfiles (guion 12 §7 actualizado).
- **Aceptación:** axe sin violaciones graves en los tres viewports y dos temas; capturas aprobadas; Gate V2 cerrado por Álvaro.

## 5. Secuencia y puntos de GO

```
Gate D (Álvaro) ─► V2-01 ─► V2-02 ─► [revisión del catálogo /_ds] ─► V2-03 ─► V2-04 ─► V2-05..08 ─► V2-09
                      └─ cada WO: batería verde → commit → GO por SHA → Preview → validación
```

V2-05 a V2-08 son independientes entre sí tras V2-04 y pueden ordenarse según prioridad de negocio.

## 6. Decisiones pendientes

| ID  | Decisión                                                                                                | Recomendación                                                                              |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| D-1 | Tema por defecto durante la transición                                                                  | `legacy` hasta V2-09; V2 seleccionable con `hf_ui`                                         |
| D-2 | Capturas de referencia en Git (8,4 MB hoy; crece con cada WO)                                           | Versionar mientras sean < 30 MB en total; después, Git LFS o artefacto                     |
| D-3 | `tools/heyfoxy-qa` se sube con cada Preview (`.vercelignore` raíz no lo excluye; es archivo compartido) | Añadir `tools/heyfoxy-qa` al `.vercelignore` con el visto bueno del responsable de ForgeOS |
| D-4 | Ilustraciones adicionales (saludo de Home, estados vacíos) más allá de `FoxyMark`                       | SVG originales dentro de V2-02, mismo criterio que la mascota                              |
