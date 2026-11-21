# Hey Foxy V2 — Design System · Versión 0.1

**Estado:** dirección conceptual aprobada; especificación para prototipado, no implementación final.  
**Referentes:** Talkwalker (analítica exploratoria), Emplifi (operación social). Sin copiar sus interfaces.

## Principios

1. Visual primero: publicaciones, videos, gráficos e iconos con información contextual.
2. Menos saturación: jerarquía clara, superficies diferenciadas por módulo y espacios generosos.
3. Evidencia conectada: KPI → tendencia → publicación → comentario → alerta → incidente.
4. Foxy como copiloto: explicar, citar evidencia, sugerir; acciones críticas requieren confirmación humana.
5. Estados transparentes: distinguir datos sintéticos, reales, cobertura parcial y fuentes desconectadas.
6. Accesibilidad: WCAG AA, foco visible, contraste, etiquetas junto a iconos críticos, movimiento reducido.

## Tokens propuestos (sujetos a contraste y validación)

| Token              | Valor   | Uso                               |
| ------------------ | ------- | --------------------------------- |
| brand.primary      | #6C35FF | Botón primario, navegación activa |
| brand.secondary    | #9A6CFF | Gradientes y énfasis              |
| brand.pale         | #EDE7FF | Fondo de inteligencia IA          |
| status.success.bg  | #E8F9F0 | Confirmaciones y positivo         |
| status.info.bg     | #E7F3FF | Información y seguimiento         |
| status.warning.bg  | #FFF7E6 | Advertencias                      |
| status.critical.bg | #FFECEF | Alertas críticas                  |
| surface.base       | #F8FAFF | Fondo global claro                |
| surface.card       | #FFFFFF | Tarjetas y paneles                |
| text.primary       | #14152E | Texto principal                   |
| text.secondary     | #626781 | Texto secundario                  |
| border.subtle      | #E3E7F2 | Bordes suaves                     |

**Modo oscuro:** definir pares semánticos equivalentes; no invertir colores automáticamente. Estados nunca deben depender solo del color.

## Tipografía y escala

- Familia propuesta: **Nunito**, pesos Regular 400, Semibold 600, Bold 700, ExtraBold 800, Black 900.
- Display 32–36 px; H1 26–30 px; H2 20–24 px; H3 16–18 px; cuerpo 14–16 px; etiquetas 12–13 px.
- Line-height: cuerpo 1.45–1.6. Cifras de KPI con tabulares cuando estén disponibles.

## Geometría y espaciado

- Escala de 4 px: 4, 8, 12, 16, 24, 32, 48.
- Radios: 10 px controles, 16 px tarjetas, 20–24 px paneles destacados.
- Tarjetas: borde sutil y sombra muy suave, sin gradientes fuertes en todas las superficies.
- Desktop: sidebar 224–256 px, contenido fluido; vista de conversación en tres columnas adaptables.
- Tablet: sidebar compacta y panel contextual plegable. Móvil: una columna con navegación por niveles.

## Iconografía

- Base consistente: Lucide o equivalente SVG, trazo 1.75–2 px, tamaños 16/20/24 px.
- Redes: iconos oficiales según guías de marca.
- Módulos: Home (house), Resumen (chart), Explorer (images), Conversaciones (messages-square), Alertas (bell-ring), Incidentes (shield-alert), Reportes (chart-no-axes-combined), Foxy IA (sparkles), Configuración (settings).
- Iconos con tooltip y texto en acciones importantes; no usar emoji como sustituto del sistema de iconos.

## Componentes reutilizables

1. AppShell: navegación, selector de organización, buscador global, rango temporal y usuario.
2. PageHeader: contexto, título, descripción, acciones.
3. KPI Card: valor, unidad, período, delta y estado de comparabilidad.
4. ChartCard: título, explicación, leyenda, selección y drill-down a evidencia.
5. SocialPostCard: red, autor, contenido multimedia, enlace original, métricas, cobertura y comentarios.
6. ConversationRow: avatar, red, extracto, sentimiento, intención, gravedad, prioridad, responsable y estado.
7. FoxyInsightPanel: hallazgo, evidencia, confianza, limitaciones, acciones propuestas y aprobación.
8. AlertCard: severidad, estado, razón, fuente, evidencia y confirmación/descartado con motivo.
9. IncidentWorkspace: timeline, asignaciones, notas, SLA, resolución y auditoría.
10. CoverageBanner: redes conectadas, ausencias, permisos, retrasos y alcance de conclusiones.
11. ReportComposer: período, filtros, comparadores, resumen, evidencia y exportación.
12. Empty/Loading/Error/Permission States: estados explícitos y recuperables.

## Arquitectura de experiencia

### 01 Intelligence Home

Pulso reputacional, tendencias, indicadores, señales emergentes, publicaciones relevantes y recomendaciones de Foxy.

### 02 Social Explorer

Galería de publicaciones con miniaturas reales autorizadas, filtros y detalle contextual. Acceso a comentarios y fuente original.

### 03 Conversation Studio

Bandeja priorizada | hilo y publicación original | Foxy IA y acciones. Respuestas solo si permisos y APIs lo permiten.

### 04 Reputation War Room

Alertas, incidentes, responsables, historial, evidencia, decisiones y seguimiento.

### 05 Insights & Reports

Visión general, benchmarking, temas, audiencias y reportes; drill-down a evidencia. Mostrar “sin base comparable” cuando no existan datos previos.

## Reglas de datos y seguridad

- No simular capacidades reales como conectadas. Etiquetar claramente el contenido de demostración.
- Mostrar publicación original y medios solo cuando la API y los permisos lo permitan; proporcionar fallback con enlace.
- Metricool Advanced: validar campos y límites reales con prueba de solo lectura antes de prometer cobertura.
- Nunca mezclar datos de organizaciones; RLS y controles server-side obligatorios.
- Confirmación humana para escalamiento, publicación, respuesta, cambios de estado críticos y envíos WhatsApp.
- Registrar quién, cuándo, qué cambió y motivo en auditoría.
- No mostrar porcentajes de variación cuando el período base sea cero; usar “Sin base comparable”.

## Interacciones

- Drill-down sin perder filtros ni período.
- Panel lateral de detalle; navegación con teclado; estados hover, focus, loading, disabled, success y error.
- Animaciones 120–220 ms, discretas y compatibles con prefers-reduced-motion.
- Todas las gráficas deben ofrecer tabla alternativa accesible.

## Entregables de diseño antes de programar

1. Prototipos de cinco espacios en desktop y móvil.
2. Biblioteca de componentes y variantes; tokens light/dark.
3. Flujos de publicación→comentario→alerta→incidente→reporte.
4. Auditoría de accesibilidad y test con usuarios (director de marca, analista y responder).
5. Matriz de viabilidad de API y estados sin datos.
6. WO técnica por fases, con QA y rollback, sin alterar Production hasta aprobación.

## Estado

Este documento consolida decisiones visuales y patrones UX acordados; los mockups son conceptuales y no representan una aplicación implementada ni métricas verificadas.
