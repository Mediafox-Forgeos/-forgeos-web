# Hey Foxy V2 — Design System · Versión 0.2

| Propiedad  | Valor                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Estado     | **Dirección visual aprobada por Álvaro (2026-11-20).** Especificación para implementar por fases; no es código todavía  |
| Versión    | 0.2 — corrige la 0.1 con las decisiones de Álvaro y el contraste medido (ver [Historial](#historial))                   |
| Referentes | Talkwalker (analítica exploratoria) y Emplifi (operación social). Inspiración de patrones, **sin copiar** interfaces    |
| Referencia | [`HEY_FOXY_V2_CONCEPT.png`](./HEY_FOXY_V2_CONCEPT.png): concepto visual, **no** una app implementada ni métricas reales |
| Plan       | [13 — Arquitectura UX/UI](../13_V2_UX_UI_ARCHITECTURE.md) y [14 — Plan por fases](../14_V2_PHASE_PLAN.md)               |

## Principios

1. **Visual primero:** publicaciones, videos, gráficos e iconos con información contextual.
2. **Menos saturación:** jerarquía clara, superficies diferenciadas por módulo y espacios generosos. Sofisticado, no recargado.
3. **Evidencia conectada:** KPI → tendencia → publicación → comentario → alerta → incidente. Navegación contextual sin perder filtros.
4. **Foxy como copiloto:** explica, cita evidencia y sugiere; las acciones críticas requieren confirmación humana.
5. **Estados transparentes:** distinguir datos sintéticos, reales, cobertura parcial, fuentes desconectadas y funciones futuras.
6. **Iconografía funcional abundante:** cada módulo, métrica y estado tiene icono, siempre acompañado de texto en lo crítico.
7. **Accesibilidad WCAG 2.2 AA:** foco visible, contraste, etiquetas junto a iconos críticos, movimiento reducido, tablas alternativas.
8. **Responsive:** escritorio, tablet y móvil son diseños, no reducciones.

## Tokens

Variables CSS semánticas. Los valores claros vienen del concepto; los ajustes marcados con ✱ corrigen el contraste medido (WCAG 1.4.3 y 1.4.11).

### Tema claro

| Token                          | Valor                 | Uso                                             | Contraste / regla                                    |
| ------------------------------ | --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `brand.primary`                | `#6C35FF`             | Botón primario, navegación activa, enlaces      | Blanco sobre él 5,85:1; sobre tarjeta 5,85:1 ✓       |
| `brand.secondary`              | `#9A6CFF`             | Gradientes y énfasis decorativo                 | 3,52:1: **nunca texto normal ni único indicador** ✱  |
| `brand.pale`                   | `#EDE7FF`             | Fondo de Foxy IA y del módulo de inteligencia   | `brand.primary` sobre él 4,87:1 ✓                    |
| `surface.base`                 | `#F8FAFF`             | Fondo global                                    | —                                                    |
| `surface.card`                 | `#FFFFFF`             | Tarjetas y paneles                              | —                                                    |
| `text.primary`                 | `#14152E`             | Texto principal                                 | 17,09:1 ✓                                            |
| `text.secondary`               | `#626781`             | Texto secundario                                | 5,33:1 ✓                                             |
| `border.subtle`                | `#E3E7F2`             | Bordes decorativos de tarjetas                  | 1,24:1: **solo decorativo** ✱                        |
| `border.control` ✱             | `#7E849E`             | Inputs, checkboxes, toggles, límites de control | 3,70:1 ✓ (1.4.11)                                    |
| `status.success.bg` / `.fg` ✱  | `#E8F9F0` / `#0F7A4A` | Confirmaciones, positivo                        | Texto 4,93:1 ✓                                       |
| `status.info.bg` / `.fg` ✱     | `#E7F3FF` / `#1D5FA8` | Información, seguimiento                        | Texto 5,73:1 ✓                                       |
| `status.warning.bg` / `.fg` ✱  | `#FFF7E6` / `#8A5A00` | Advertencias, cobertura parcial                 | Texto 5,56:1 ✓                                       |
| `status.critical.bg` / `.fg` ✱ | `#FFECEF` / `#B4233C` | Alertas críticas, negativo                      | Texto 5,70:1 ✓                                       |
| `synthetic.bg` / `.fg`         | Fase 1                | Banda y etiqueta de datos sintéticos            | Hereda la regla actual (`--demo`); validar en fase 1 |

### Superficies por módulo

Fondos tonales suaves que identifican el módulo sin saturar (tarjetas siempre en `surface.card`):

| Módulo              | Tono de módulo (eyebrow, icono, fondo de cabecera)    |
| ------------------- | ----------------------------------------------------- |
| Intelligence Home   | `brand.pale`                                          |
| Social Explorer     | `status.info.bg`                                      |
| Conversation Studio | `status.success.bg`                                   |
| Reputation War Room | `status.critical.bg`                                  |
| Insights & Reports  | `brand.pale` + gradiente `brand.secondary` decorativo |
| Plataforma          | `surface.base`                                        |

### Tema oscuro

Pares semánticos definidos a mano, **sin inversión automática**. Se fijan y miden en WO-HF-V2-01 con el mismo script de contraste. Los estados nunca dependen solo del color.

### Estrategia de adopción (decisión 7)

- Se implementan **ambos sistemas de tokens** (claro y oscuro) desde la fase 1.
- **No se cambia toda la app a claro de golpe.** El tema se aplica por ámbito con `data-theme` (`v2-light` / `v2-dark`) en el contenedor de cada vista migrada; las vistas no migradas mantienen el tema actual (legado oscuro) hasta su WO.
- Cada componente se valida en el catálogo `/_ds` y cada pantalla en su WO, con capturas y axe antes y después.

## Tipografía y escala

- **Nunito** 400/600/700/800/900, autoalojada con `next/font` (sin peticiones a Google en runtime).
- Display 32–36 px; H1 26–30 px; H2 20–24 px; H3 16–18 px; cuerpo 14–16 px; etiquetas 12–13 px.
- Line-height del cuerpo 1,45–1,6. Cifras de KPI y tablas con `tabular-nums`.

## Geometría y espaciado

- Escala de 4 px: 4, 8, 12, 16, 24, 32, 48.
- Radios: 10 px controles, 16 px tarjetas, 20–24 px paneles destacados.
- Tarjetas con borde sutil y sombra muy suave; gradientes solo en acentos, nunca en todas las superficies.
- Desktop: sidebar 224–256 px y contenido fluido; Conversation Studio en tres columnas adaptables.
- Tablet: sidebar compacta (iconos con tooltip) y panel contextual plegable. Móvil: una columna, navegación por niveles, panel contextual como hoja inferior.

## Iconografía

- Base: **Lucide** (`lucide-react`), trazo 1.75–2 px, tamaños 16/20/24 px. SVG, nunca raster.
- Módulos: Inicio (`house`), Explorer (`images`), Conversaciones (`messages-square`), Alertas (`bell-ring`), Incidentes (`shield-alert`), Reportes (`chart-no-axes-combined`), Foxy IA (`sparkles`), Configuración (`settings`).
- Redes: iconos SVG de Simple Icons (CC0) según las guías de marca de cada red, sin modificar logotipos.
- Iconos con tooltip y texto en las acciones importantes. **Sin emoji** como sustituto del sistema de iconos.

## Foxy — mascota (decisión 4)

- **Componente SVG original** (`FoxyMark`), dibujado para Hey Foxy. El PNG del concepto es solo referencia visual.
- **No se usan imágenes rasterizadas** como sustituto permanente de la mascota ni de la iconografía.
- Variantes: `mark` (16–24 px, junto a «Foxy IA»), `avatar` (32–48 px, panel de insights) e `illustration` (saludo de Home). Todas con `aria-hidden` cuando son decorativas, o `role="img"` + `aria-label` cuando aportan significado.
- Colores desde tokens (funciona en claro y oscuro). Respeta `prefers-reduced-motion` si se anima.

## Componentes reutilizables

1. **AppShell:** navegación, selector de organización, buscador global, periodo y usuario.
2. **PageHeader:** eyebrow del módulo con icono, título, descripción y acciones.
3. **KpiCard:** valor, unidad, periodo, delta y comparabilidad; «Sin base comparable» si el periodo base es 0.
4. **ChartCard:** título, explicación, leyenda, tabla alternativa y drill-down a la evidencia.
5. **SocialPostCard** y **PostMedia** (decisión 8): ver la sección siguiente.
6. **ConversationRow:** avatar o iniciales, red, extracto, sentimiento, intención, gravedad, prioridad, responsable y estado.
7. **FoxyInsightPanel:** hallazgo, evidencia citada, confianza, limitaciones, acción propuesta y confirmación. Indica el origen («Generado por reglas» mientras no haya modelo conectado).
8. **AlertCard:** severidad, estado, razón, fuente, evidencia y confirmación o descarte con motivo.
9. **IncidentWorkspace:** timeline, asignaciones, notas, tiempo abierto, resolución y auditoría.
10. **CoverageBanner:** redes conectadas, ausentes, permisos, retrasos y alcance de las conclusiones.
11. **ReportComposer:** periodo, filtros, comparadores, resumen, evidencia y exportación.
12. **Estados:** Empty, Loading, Error, Permission, **NotAvailable** («Sin datos disponibles») y **ComingSoon** («Próximamente»).
13. **Primitivas:** Button, Tabs, Chip, Toggle, Checkbox, Tooltip, StatusPill, SyntheticBadge, NetworkIcon, Avatar, FoxyMark.

### Publicaciones reales: medios, autores y comentarios (decisión 8)

Los componentes se preparan para datos reales aunque **hoy no existan** (Metricool sin conectar, sin columna de medios):

| Capacidad              | Componente                                                                   | Sin datos                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fotografía             | `PostMedia` tipo `image` (con `alt` obligatorio)                             | Icono de la red + «Vista previa no disponible» + enlace al original                                    |
| Video                  | `PostMedia` tipo `video` (póster, duración, controles nativos, sin autoplay) | Igual que arriba                                                                                       |
| Carrusel               | `PostMedia` tipo `carousel` (contador «1/5», navegación por teclado)         | Igual que arriba                                                                                       |
| Avatar y autor         | `AuthorChip` (avatar, nombre, cuenta, red)                                   | Iniciales o icono de la red; los autores de comentarios siguen con `author_hash` (minimización de PII) |
| Métricas               | `PostMetrics` (alcance, interacciones, comentarios, compartidos, vistas)     | «—» por métrica ausente; nunca 0 inventado                                                             |
| Comentarios vinculados | `LinkedComments` (lista y enlace a Conversation Studio)                      | `EmptyState` explícito                                                                                 |
| Publicación original   | `OriginalLink` (abre en pestaña nueva, `rel="noopener noreferrer"`)          | Oculto si no hay URL                                                                                   |

Reglas: los medios se muestran solo si la API y los permisos lo permiten; **nunca** se inventan miniaturas, avatares ni métricas. Los datos demo usan medios marcados como sintéticos o el fallback. Almacenar medios reales (`media_url`, etc.) requiere una migración con **GO aparte**.

## Arquitectura de experiencia

### 01 Intelligence Home (`/`)

Pulso reputacional, KPI, tendencias, señales emergentes, publicaciones relevantes y hallazgos de Foxy. **Integra el antiguo «Resumen»** (decisión 2, opción A): no hay dos pantallas.

### 02 Social Explorer

Galería de publicaciones con medios autorizados (o fallback), filtros y detalle en panel lateral con ruta propia. Acceso a comentarios y al original.

### 03 Conversation Studio

Bandeja priorizada | hilo con publicación original | Foxy IA y acciones. Respuestas solo si permisos y APIs lo permiten.

### 04 Reputation War Room

Alertas, revisión humana, incidentes, responsables, historial, evidencia, decisiones y seguimiento.

### 05 Insights & Reports

Visión general, temas y tendencias, reportes. **Benchmark** y **Audiencia** se muestran como «Próximamente» o «Sin datos disponibles» (decisión 5), sin métricas, publicaciones ni competidores inventados. «Sin base comparable» cuando no haya periodo previo.

## Reglas de datos y seguridad

- No simular capacidades reales como conectadas. Etiquetar claramente el contenido de demostración.
- Medios solo cuando la API y los permisos lo permitan; fallback con enlace.
- Metricool Advanced: validar campos y límites reales con una prueba de solo lectura (con su propio GO) antes de prometer cobertura.
- Nunca mezclar datos de organizaciones: RLS y controles en servidor; la UI nunca es la barrera.
- Confirmación humana para escalamiento, publicación, respuesta, cambios de estado críticos y envíos de WhatsApp.
- Auditoría de quién, cuándo, qué cambió y por qué.
- Sin porcentaje de variación si el periodo base es cero: «Sin base comparable».

## Interacciones

- Drill-down sin perder filtros ni periodo.
- Panel lateral de detalle; navegación completa por teclado; estados hover, focus, loading, disabled, success y error.
- Animaciones de 120–220 ms, discretas y desactivadas con `prefers-reduced-motion`.
- Toda gráfica ofrece una tabla alternativa accesible.

## Validación

- Contraste verificado por script en cada cambio de tokens (claro y oscuro).
- `tools/heyfoxy-qa`: capturas a 390/820/1440 px, axe WCAG 2.2 A/AA y deuda conocida versionada; ninguna WO puede introducir violaciones graves nuevas.

## Inteligencia de contenido (v0.3 · WO-HF-V2-INTELLIGENCE-001)

Componentes reutilizables para Social Explorer, Intelligence Home, Campaign Intelligence, Reputation War Room, Insights & Reports, Competitive Intelligence y Foxy Brand Brain. Código: `components/ds/performance.tsx`, `intel.tsx`, `intel-findings.tsx`, `intel-client.tsx`, `post.tsx`, `post-client.tsx`. Catálogo vivo en `/ds`.

### Tokens nuevos

| Token                                              | Uso                                    | Claro             | Oscuro            | Contraste sobre `card` (mín. 3:1) |
| -------------------------------------------------- | -------------------------------------- | ----------------- | ----------------- | --------------------------------- |
| `metric-reach`                                     | Alcance (violeta)                      | `#6C35FF`         | `#AC8CFF`         | 5,85 / 6,62                       |
| `metric-engagement`                                | Engagement (verde)                     | `#149660`         | `#4FDC96`         | 3,85 / 9,83                       |
| `metric-impressions`                               | Impresiones (azul)                     | `#2271C4`         | `#70B6FF`         | 5,09 / 8,01                       |
| `metric-interactions`                              | Interacciones (naranja)                | `#E05F06`         | `#FF9A52`         | 3,68 / 8,21                       |
| `ix-likes · comments · shares · saves · reactions` | Tipos de interacción (anillo y barras) | ver `globals.css` | ver `globals.css` | ≥ 3,98 / ≥ 6,98                   |

Verificados por `scripts/check-contrast.mjs`. Los colores de métrica se usan en iconos, barras y acentos; el texto usa `foreground` / `*-fg` (4,5:1).

### Componentes

| Componente                                                       | Anatomía                                                                                                                                                                                                                                                                  | Estados y reglas                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PerformanceMetricCard**                                        | Barra superior de color · icono Lucide en fondo tenue · etiqueta (con nombre real de la red) · `InfoTip` con la definición · valor 28 px extrabold · variación vs. medición anterior · fuente · comparación opcional                                                      | Sin valor muestra `MetricAvailabilityState`, nunca 0 inventado. Facebook: «Impresiones únicas» en lugar de alcance                                          |
| **MetricAvailabilityState**                                      | Píldora 11 px                                                                                                                                                                                                                                                             | Cero real · No disponible en la fuente · No aplica a este formato · Pendiente de sincronización · Desactivado por privacidad                                |
| **InteractionBreakdown**                                         | `ChartCard` + anillo (`Donut`, leyenda interactiva) + barras horizontales (icono, nombre, cantidad, %) + tabla accesible + nota de definiciones                                                                                                                           | Solo componentes que la red desglosa; si el total de la red difiere, se explica; «Comentarios en la red» ≠ comentarios importados                           |
| **PerformanceTimeline**                                          | Selector de métrica (botones `aria-pressed`) + `AreaTrend` + nota de variación + tabla en `ChartCard`                                                                                                                                                                     | Solo mediciones reales; una sola medición → estado; sin variación → lo dice                                                                                 |
| **FoxyContentIntelligence**                                      | Cabecera con Foxy, pregunta guía y proveedor · subnavegación de capas · fichas resumen (temática, territorio, formato, objetivo, pilar, campaña, hook, CTA) · capas Contenido / Rendimiento / Estrategia / Creatividad / Reputación · próximas capacidades · limitaciones | Protagonista del detalle (`rounded-panel`, `shadow-lift`). Sin contexto de Brand Brain, lo indica y enlaza                                                  |
| **FindingCard · StrategicInsightCard · CreativeOpportunityCard** | Raíl izquierdo de color · insignia de naturaleza · confianza · título · detalle · evidencias · limitación · acción                                                                                                                                                        | HECHO azul (`info`), INTERPRETACIÓN violeta (`ai`), HIPÓTESIS ámbar (`warning`), RECOMENDACIÓN verde (`success`). Nunca una hipótesis como hecho            |
| **EvidenceReference**                                            | Chip 11 px con icono por tipo (publicación, métrica, Brand Brain, documento, comparación)                                                                                                                                                                                 | Enlaza a la publicación citada; referencias fuera de la entrada se descartan en el servidor                                                                 |
| **AskFoxyContextual**                                            | Cabecera con alcance · preguntas sugeridas · conversación (burbuja del usuario + hallazgos) · campo «Pregúntale lo que quieras a Foxy...»                                                                                                                                 | Contexto reconstruido en servidor; etiqueta «Motor local por reglas · sin IA generativa»; respuestas no fundamentables lo dicen; datos sintéticos señalados |
| **RecommendationAction**                                         | Botón píldora «Guardar como aprendizaje»                                                                                                                                                                                                                                  | Crea una propuesta (validación humana). Otras acciones solo como «próximamente», deshabilitadas                                                             |
| **BrandContextCard**                                             | Icono Brain · completitud de campos esenciales · pilares y campañas · enlace                                                                                                                                                                                              | Pendiente de 0007 / sin contexto / sintético                                                                                                                |
| **AccountIdentity** (`AuthorChip`)                               | Avatar real o iniciales · icono de red · nombre · etiqueta «Marca» si es la identidad de la marca conectada · @usuario · tiempo                                                                                                                                           | Nunca un avatar inventado                                                                                                                                   |
| **MediaViewer** (`PostMedia` + `MediaZoom`)                      | Medio único o carrusel · insignia «Portada · N elementos» · visor ampliado en diálogo nativo                                                                                                                                                                              | Caducada: «Vista previa caducada · Ábrela en la red original», sin pedir la URL                                                                             |
| **ExpandableCopy**                                               | Texto 15 px peso normal, `line-clamp-6`, botón «Ver todo el texto»                                                                                                                                                                                                        | Sin texto: «Publicación sin texto»                                                                                                                          |

### Composición del detalle de publicación

Sustituida en v0.4 (ver abajo). La columna fija de v0.3 se retiró: era más alta que la pantalla con el copy expandido (HF-UX-17).

## Inteligencia estratégica (v0.4 · WO-HF-V2-UX-REFINEMENT-002)

Consolida los hallazgos de la validación del Preview `b499fe1`. Código nuevo: `components/ds/copilot.tsx`, `learning-review.tsx`; ampliados `intel.tsx`, `intel-client.tsx`, `intel-findings.tsx`, `performance.tsx`, `charts-client.tsx`. Lógica: `lib/intel/brand.ts` (marca), `common.ts`, `summary.ts`. Sin estilos aislados por pantalla: todo usa los tokens de v0.2–v0.3 (Nunito, Lucide, violeta `#6C35FF`, superficies por módulo, colores semánticos y de métrica).

### Reglas de datos de las visualizaciones

1. **Nunca se compara ni se ordena entre redes.** Metricool calcula el engagement de Instagram sobre el alcance y el de Facebook sobre las impresiones únicas. Cada red se resume, se ordena y se grafica por separado; si se muestran juntas, se advierte.
2. **Un acumulado de alcance no son personas únicas.** Se rotula «suma por publicación».
3. **Muestra y periodo siempre visibles** (n por formato, número de equivalentes, periodo). Con n menor que 3 la barra se atenúa y no se calcula la mediana.
4. **Descriptivo, no causal.** Toda comparación lo dice en su nota.
5. **Solo puntos reales.** Un punto por medición o por publicación; nunca puntos intermedios.
6. **Confianza solo en lo interpretativo.** Los hechos no llevan nivel de confianza; el validador lo impone para cualquier proveedor (`normalizeFinding`).

### Componentes

| Componente                                        | Anatomía                                                                                                                                                                                                                                                                         | Estados y reglas                                                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FoxyExecutiveBrief**                            | Cabecera Foxy con la pregunta «¿Qué debería saber hoy el director de marca?» y el motor · lista numerada de 3 a 5 hallazgos con su área (rendimiento, aprendizaje, estrategia, oportunidad creativa, cambios, riesgo) · hallazgo y recomendación lado a lado · acceso al detalle | Prioridad fija: riesgo (solo con comentarios autorizados) → rendimiento → aprendizaje → estrategia → creatividad → cambios. Sin métricas: lo dice en un único hallazgo                                              |
| **ExecutiveInsightSummary**                       | Dos columnas: «Lo más importante» (3–5 hallazgos) y «Recomendaciones» con «Guardar como aprendizaje»                                                                                                                                                                             | Toma los hallazgos tal cual del análisis, sin reescribirlos ni duplicarlos                                                                                                                                          |
| **IntelligenceTabs**                              | `tablist` con píldoras y contador · un único `tabpanel` visible                                                                                                                                                                                                                  | Patrón ARIA de pestañas: flechas, Inicio y Fin. Resumen · Contenido · Rendimiento · Estrategia · Creatividad · Reputación                                                                                           |
| **EvidenceDisclosure**                            | `<details>` «Evidencia (n)» con chevron y `EvidenceReference`                                                                                                                                                                                                                    | Cerrada por defecto; se abre con clic o teclado                                                                                                                                                                     |
| **ContextualCopilotPanel**                        | Botón «Foxy IA» en la barra superior · panel lateral de 440 px (pantalla completa en móvil) · cabecera con pantalla y contexto · preguntas sugeridas · conversación · campo de pregunta · acceso a Ask Foxy general                                                              | Cada pantalla declara su contexto con `CopilotScope` (organización, publicación, red, periodo, filtros). La conversación se conserva por contexto. Escape cierra y devuelve el foco. Cerrado no renderiza contenido |
| **FoxyAnswer**                                    | Respuesta principal · hallazgos con evidencia expandible · bloque «Recomendaciones» · bloque «Limitaciones» · «Preguntas de seguimiento»                                                                                                                                         | Turnos con estado `pending → streaming → done`, listos para un proveedor con streaming. Si no puede responder, lo dice                                                                                              |
| **PerformanceComparison**                         | Barras «Esta publicación» frente a «Mediana de equivalentes» (engagement, alcance o impresiones únicas, interacciones) · engagement por formato en la red · nota de definición                                                                                                   | Solo misma red y mismo tipo de formato; con menos de 3 equivalentes, «Base insuficiente» sin mediana                                                                                                                |
| **ResponsiveIntelligenceLayout**                  | Dos columnas desde `lg` (5 + 7): pieza principal y visualizaciones                                                                                                                                                                                                               | Ninguna columna fija; una columna por debajo de `lg`                                                                                                                                                                |
| **LearningReviewCard**                            | Tipo · estado · sintético · título · texto · evidencia · autor y fecha · decisión, revisor, fecha y motivo · nota · Aprobar / Rechazar / Archivar                                                                                                                                | Solo owner/admin. Rechazar exige motivo (0008). Transiciones: propuesto → aprobado, rechazado o archivado; aprobado o rechazado → archivado                                                                         |
| **CoverageStatus**                                | Icono semántico · título · detalle                                                                                                                                                                                                                                               | Disponible · Sin conversaciones detectadas · Comentarios no importados · Fuente no conectada · Desactivado por privacidad. La ausencia de comentarios nunca se presenta como ausencia de conversación               |
| **InteractionBreakdown** (revisado)               | Anillo sin leyenda propia + barras (punto de color, icono, nombre, cantidad, %) + tabla                                                                                                                                                                                          | Fila en una línea (nombre truncable, valor sin salto). `stacked` en contenedores estrechos. Tooltips nativos en arcos y filas                                                                                       |
| **PerformanceTimeline** (sin cambios de anatomía) | —                                                                                                                                                                                                                                                                                | Ahora a todo el ancho en el detalle                                                                                                                                                                                 |
| **BrandContextCard** (revisado)                   | Completitud · versión · objetivos, pilares y campañas (modo `detailed`) · campos que faltan · aprendizajes aprobados y pendientes · «Configurar» o «Abrir»                                                                                                                       | Vacío útil: explica qué falta y por dónde empezar                                                                                                                                                                   |
| **PerformanceMetricCard** (revisado)              | Igual que v0.3                                                                                                                                                                                                                                                                   | Sin `overflow-hidden`; el tooltip ocupa el ancho de la tarjeta (`InfoTip align="card"`) y nunca sale de ella ni de la pantalla (HF-UX-15)                                                                           |

### Composición

- **Intelligence Home:** cabecera ejecutiva (marca, periodo, fuentes, última medición, «Preguntar a Foxy») → Publicaciones y Redes conectadas + KPI por red → Executive Brief (8 col.) junto a Brand Brain y preguntas sugeridas (4 col.) → Publicaciones destacadas con motivo → Content performance por red → Reputación.
- **Detalle de publicación:** cabecera y navegación → 4 KPI a todo el ancho → publicación original (5 col.) junto a distribución y rendimiento comparable (7 col.) → evolución a todo el ancho → Foxy Intelligence con pestañas → preguntas al copiloto → comentarios y cobertura (8 col.) junto a Brand Brain (4 col.).
- Validado sin desbordamiento a 390, 500, 820, 1440, 1536 y 1920 px, en claro, oscuro y clásico.

## Foxy Intelligence Engine (v0.5 · WO-HF-AI-ENGINE-001)

Estados del motor de inteligencia, con IA generativa preparada pero sin activar. Código nuevo: `components/ds/ai-engine.tsx`, `ai-engine-client.tsx`; ampliados `intel-client.tsx` (conversación en streaming), `copilot.tsx` e `intel.tsx`. Sin tokens nuevos: se usan los semánticos (`ai`, `warning`, `critical`, `muted`).

### Regla de honestidad

Cada respuesta y cada análisis dicen qué motor los produjo:

- **Motor local por reglas.**
- **IA generativa**, con el modelo exacto.
- **Simulación con fixtures · sin IA real**, solo en desarrollo local.
- **Respaldo: motor local por reglas**, con el motivo.

Nunca se presenta una respuesta simulada o de reglas como IA generativa.

### Componentes

| Componente                    | Anatomía                                                                                                                                              | Estados y reglas                                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EngineBadge / MetaBadge**   | Píldora con icono (CPU, destello, matraz, prohibido) y etiqueta truncable                                                                             | `local` (neutro) · `available` y `generative` (AI) · `simulated` y `fallback` (advertencia)                                                                                                                       |
| **AiStateNotice**             | Borde y fondo semánticos · icono · título · detalle · acción opcional                                                                                 | `info`, `warning`, `critical` (`role=alert`), `neutral`                                                                                                                                                           |
| **FallbackNotice**            | AiStateNotice con el título del motivo                                                                                                                | No activada · sin configurar · interruptor · datos no autorizados · contenido sensible · presupuesto agotado · error del proveedor · salida descartada · aislamiento                                              |
| **BrandContextNotice**        | «Contexto estratégico no disponible / incompleto (Brand Brain vN)» + «Completar Foxy Brand Brain»                                                     | Sin contexto no se evalúa la alineación estratégica ni se supone                                                                                                                                                  |
| **MediaCoverageNote**         | Insignia o aviso de cobertura visual                                                                                                                  | Imagen completa analizada · Portada de carrusel analizada (1 de N) · Miniatura de video analizada (no el video) · Imagen no disponible · Imagen caducada                                                          |
| **AdjustmentsNote**           | `<details>` «Verificación aplicada por Hey Foxy (n)»                                                                                                  | Referencias inventadas descartadas; reglas de negocio aplicadas (comparación entre redes, sentimiento sin comentarios, causalidad, muestra insuficiente, pilar o campaña inexistente, estrategia sin Brand Brain) |
| **GenerativeAnalysisControl** | Botón «Analizar con IA generativa» o «Actualizar análisis con IA» · aviso «Análisis desactualizado» · aviso de resultado                              | El análisis tiene costo y solo se hace a petición de owner, admin o analyst. Pasa de «Generando análisis…» a completado. Con el motor local por defecto no se muestra (la cabecera ya lo dice)                    |
| **ConversationalAnswer**      | Respuesta principal (prosa) · interpretación · Evidencia (n) desplegable · recomendaciones con su evidencia · limitaciones · preguntas de seguimiento | Se muestra por partes durante el streaming, con un cursor e «Escribiendo…». Avisa si la respuesta está incompleta o no cita evidencia                                                                             |
| **AskBox** (revisado)         | Campo + enviar; durante la respuesta, «Detener respuesta» (cuadrado)                                                                                  | Cancelar corta la generación también en el proveedor; lo recibido queda atenuado y marcado como incompleto                                                                                                        |

### Estados cubiertos (WO §12)

| Estado                            | Cómo se muestra                                             |
| --------------------------------- | ----------------------------------------------------------- |
| Motor local                       | EngineBadge `local`                                         |
| IA generativa disponible          | EngineBadge `available` y botón de análisis                 |
| Generando análisis                | El botón cambia a «Generando análisis…»                     |
| Respuesta en streaming            | ConversationalAnswer parcial                                |
| Análisis completado               | MetaBadge con modelo, versión de Brand Brain, fecha y costo |
| Error de proveedor                | FallbackNotice crítico y respuesta local                    |
| Presupuesto agotado               | FallbackNotice de presupuesto                               |
| Contexto estratégico insuficiente | BrandContextNotice                                          |
| Evidencia no disponible           | Nota «Evidencia no disponible»                              |
| Análisis multimodal parcial       | MediaCoverageNote                                           |

Validado sin desbordamiento a 390, 820, 1440 y 1536 px, en claro y oscuro (capturas con fixtures en `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-27/ai-engine-001`).

## Historial

| Versión | Fecha      | Cambios                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 2026-11-14 | Dirección conceptual, tokens propuestos, componentes y cinco espacios                                                                                                                                                                                                                                                                                                                           |
| 0.2     | 2026-11-20 | Decisiones de Álvaro: Home integra el Resumen (A); Foxy como SVG original; Benchmark/Audiencia «Próximamente / Sin datos disponibles»; claro y oscuro con adopción progresiva por ámbito; componentes de medios, autores y comentarios. Contraste: `border.control`, textos de estado y restricción de `brand.secondary`. Superficies por módulo                                                |
| 0.5     | 2026-11-27 | Foxy Intelligence Engine: EngineBadge, AiStateNotice, FallbackNotice, BrandContextNotice, MediaCoverageNote, AdjustmentsNote, GenerativeAnalysisControl, ConversationalAnswer; AskBox con «Detener respuesta»; regla de honestidad del motor y diez estados                                                                                                                                     |
| 0.4     | 2026-11-26 | Inteligencia estratégica: FoxyExecutiveBrief, ExecutiveInsightSummary, IntelligenceTabs, EvidenceDisclosure, ContextualCopilotPanel, FoxyAnswer, PerformanceComparison, ResponsiveIntelligenceLayout, LearningReviewCard, CoverageStatus; InteractionBreakdown, BrandContextCard y PerformanceMetricCard revisados; reglas de datos de las visualizaciones; nueva composición de Home y detalle |
| 0.3     | 2026-11-26 | Inteligencia de contenido: tokens de métricas e interacciones; PerformanceMetricCard, MetricAvailabilityState, InteractionBreakdown, PerformanceTimeline, FoxyContentIntelligence, hallazgos por naturaleza, EvidenceReference, AskFoxyContextual, RecommendationAction, BrandContextCard, AccountIdentity, MediaViewer, ExpandableCopy; composición del detalle                                |
