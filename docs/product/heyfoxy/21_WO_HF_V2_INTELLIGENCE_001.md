# 21 — WO-HF-V2-INTELLIGENCE-001 (+ addendum): estabilización e inteligencia de contenido

| Propiedad | Valor                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-26                                                                                  |
| Rama      | `feat/heyfoxy-v2-uxui` (sin fusión a `main`). Gate D abierto                                |
| Remoto    | Sin cambios: sin migraciones remotas, sin sincronizaciones, sin despliegue                  |
| IA        | Motor **local** por reglas. Ningún dato (real ni sintético) se envía a un proveedor externo |

Visión rectora en [00](./00_PRODUCT_VISION.md).

## 1. Fase A — Estabilización Metricool (local)

| Hallazgo | Corrección                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HF-MC-03 | En el piloto cada sincronización manual refresca la ventana completa de 30 días (`refreshFullWindow`), con el tope de 10 por red; mismas llamadas. Una medición por publicación y ejecución (dedupe posts/reels)                                       |
| Medios   | Se renuevan las referencias que entregue Metricool; `url_status` y `checked_at` se calculan con la caducidad `oe=` del CDN de Meta; el resultado cuenta «referencias renovadas»                                                                        |
| HF-UX-09 | Identidad: la de la publicación si llega; si no, la marca conectada (nombre, usuario por red e imagen que entrega Metricool, refrescados en cada sincronización con 1 llamada), etiquetada «Marca». Nunca «Cuenta no disponible» si conocemos la marca |
| HF-UX-10 | El aviso separa fuentes, redes, tipos de dato escuchados, no disponibles en la fuente y **desactivados por privacidad**                                                                                                                                |
| HF-UX-11 | La matriz muestra el total guardado por red y, aparte, lo de la última ejecución                                                                                                                                                                       |
| HF-UX-12 | Detalle: «Importación de comentarios desactivada por la política de privacidad del piloto»; «Límites del piloto» actualizado                                                                                                                           |
| HF-UX-13 | Interacciones de Hey Foxy = componentes que la red desglosa (me gusta, comentarios en la red, compartidos, guardados). Coincide con la red cuando esta desglosa todo (MedPlus: 9 + 1 = 10); si no, se explica la diferencia                            |
| HF-UX-14 | El periodo se conserva en los enlaces internos del shell y del aviso de cobertura                                                                                                                                                                      |

## 2. Fase B — Medios e identidad

Visor ampliado (`MediaZoom`, diálogo nativo) con la mejor resolución que entrega la fuente; portada de carrusel con «Portada · N elementos»; publicaciones sin texto explícitas; caducadas mostradas como tales sin pedirlas. **Estrategia de renovación:** refresco de 30 días por sincronización + detección de caducidad. **Miniaturas privadas:** ya preparadas en 0006 (bucket `hf-media`, `copy_allowed`), **no activadas**: requieren licencia/autorización de la fuente y GO.

## 3. Fase C — Foxy Intelligence Engine V1

- `lib/intel/`: `metrics` (definiciones, estados, distribución), `local` (motor por reglas), `guard` (proveedor, prompt injection, validación de evidencia, hash), `engine` (orquestador servidor con caché por hash de entrada), `schema` (salida validada con zod).
- Capas: contenido (formato, copy, hook, CTA, temática, objetivo probable), rendimiento (frente a equivalentes de la misma red y tipo de formato; sin comparación con menos de 3), estrategia (Brand Brain), creatividad (formatos, hooks, CTA, A/B), reputación (desactivada por privacidad), limitaciones.
- Cada hallazgo es **hecho, interpretación, hipótesis o recomendación**, con evidencia y, si se fundamenta, confianza.
- **Ask Foxy** (publicación y marca): preguntas sugeridas y consulta libre; el contexto se reconstruye en el servidor desde la sesión; si la pregunta excede lo fundamentable, lo dice. Sin IA generativa: no simula respuestas.
- Seguridad: proveedor externo solo con GO y, para datos reales, solo para organizaciones en `HF_AI_REAL_DATA_ORGS` (vacío); interruptor `HF_AI_KILL_SWITCH` y `ai_kill_switch` en la base (0007); texto externo neutralizado y delimitado; referencias a publicaciones fuera de la entrada se descartan; sin registros de contenido.

## 4. Fase D — Foxy Brand Brain

- Esquema validado (`lib/brain/types`): identidad, estrategia (pilares con palabras clave, objetivos, audiencias, insights, KPI, competidores) y campañas. Página `/brand-brain`: solo owner/admin editan; los demás leen.
- Memoria estratégica: «Guardar como aprendizaje» crea una **propuesta**; validarla es humano (owner/admin).
- **Migración 0007 preparada, NO aplicada** (`supabase/migrations-pending/20261126000700_hf_brand_brain_intel.sql`): `brand_contexts` (versionado y autor), `brand_memory` (propuesta → validación), `content_intel_cache`, `ai_kill_switch`. Rollback exacto al contrato 0006. `scripts/test-migration-0007.sh`: 23 aserciones (aislamiento, roles, versión, validación humana, evidencia de otra organización rechazada).
- En Supabase, sin 0007, Brand Brain muestra «pendiente de activación» y Foxy analiza sin contexto (lo indica). En demo funciona en memoria con un contexto **sintético** marcado.
- Evolución (fuera de alcance): biblioteca documental con versiones/fechas/fuentes y búsqueda semántica cuando el volumen lo justifique; ningún documento real sin autorización ni envío a proveedores externos.

## 5. Fase E — Experiencia (Design System V2)

Detalle de publicación rediseñado: publicación original (identidad, tipo, fecha, visor, copy expandible con peso normal, enlace), 4 KPI (`PerformanceMetricCard`: alcance violeta, engagement verde, impresiones azul, interacciones naranja, con definición, fuente, variación y estado), **Foxy Content Intelligence** protagonista, `InteractionBreakdown` (anillo + barras + tabla), `PerformanceTimeline` (selector de métrica, solo mediciones reales), Ask Foxy contextual, comentarios según política, navegación anterior/siguiente con periodo y filtros. Nuevas páginas: **Ask Foxy** (`/foxy`) y **Foxy Brand Brain** (`/brand-brain`); grupo «Foxy» en la navegación. Componentes y tokens documentados en el [Design System §Inteligencia de contenido](./design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md). Temas claro, oscuro y clásico (el clásico conserva su detalle).

## 6. Proveedor de IA externo — propuesta para GO (no activado)

| Aspecto       | Propuesta                                                                                                                                                                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proveedor     | Anthropic (Claude API) con el SDK oficial `@anthropic-ai/sdk`, solo en servidor                                                                                                                                                                                                                                                          |
| Modelo        | `claude-opus-5-5` ($4 / $20 por millón de tokens de entrada / salida), con fallback por rechazo del servidor. Alternativas más económicas (p. ej. Sonnet o Haiku 5.5) son decisión de producto                                                                                                                                           |
| Estimación    | Análisis de publicación ≈ 5 000 tokens de entrada (copy, métricas, equivalentes, Brand Brain, 1 imagen) + 1 500 de salida ≈ **US$0,05**. Ask Foxy ≈ 4 000 + 800 ≈ **US$0,03** por pregunta. Piloto MedPlus (≈ 20 publicaciones/mes, caché por hash, 300 preguntas): **≈ US$12–15/mes**. Tope por `usage_budgets` (US$30/mes por defecto) |
| Datos         | Solo publicaciones propias, métricas y Brand Brain autorizados; nunca comentarios. Retención y uso según los términos comerciales de Anthropic: confirmar condiciones (y ZDR si se requiere) antes del GO de datos reales                                                                                                                |
| Prerrequisito | Instalar el SDK modifica el lockfile compartido del monorepo (su dependencia opcional `@opentelemetry/api` cambia la entrada de `next` de MediaFOX OS y MOVOS). Se revirtió; requiere GO para tocar el lockfile o aislar la dependencia                                                                                                  |
| Orden         | (1) GO del prerrequisito, (2) adaptador con fixtures sintéticos, (3) GO de datos reales de MedPlus con condiciones de tratamiento                                                                                                                                                                                                        |

**Variables para activar (Preview, servidor):** `HF_MIGRATION_0007_APPLIED=true` (tras aplicar 0007), `HF_AI_CONTENT_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` (Sensitive), `HF_AI_REAL_DATA_ORGS` (vacía hasta el GO de datos reales), `HF_AI_KILL_SWITCH` (no crear salvo emergencia). Interruptor inmediato con 0007: `update public.hf_runtime_flags set enabled = true where flag = 'ai_kill_switch';`

## 7. Pruebas

| Prueba                                                                       | Resultado                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Unitarias (motor, métricas, guardas, Brand Brain, caducidad, sincronización) | 191/191                                                |
| Persistencia real en Postgres (`test-sync-persistence`)                      | 4/4                                                    |
| Migración 0007 (`test-migration-0007`)                                       | 23 aserciones, rollback al contrato 0006               |
| `test-db`, `test-migration-0006`, `test-qa-seed`                             | OK                                                     |
| Smoke HTTP                                                                   | 63/63 (incluye Ask Foxy, Brand Brain y aislamiento)    |
| QA Playwright (8 proyectos, axe, desbordamiento, capturas)                   | 190 superadas, 98 omitidas por diseño; sin deuda nueva |

Capturas antes/después en `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-26/intelligence-001/` (fuera de Git), con datos sintéticos de la demo: las de MedPlus requieren un Preview con GO.

## 8. Limitaciones

- Motor local: sin análisis visual ni matices de tono; la temática se detecta por vocabulario.
- La caché de análisis vive en memoria del servidor; la tabla `content_intel_cache` (0007) queda para el proveedor externo.
- La identidad de MedPlus (usuario por red e imagen) se completa en la próxima sincronización autorizada.
