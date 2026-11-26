# 24 — WO-HF-V2-UX-REFINEMENT-002: Intelligence Home, Social Explorer, Ask Foxy y Brand Brain

| Propiedad   | Valor                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha       | 2026-11-26                                                                                                                            |
| Estado      | **Implementada en local.** Sin Preview, sin despliegue, sin migraciones remotas. Gate D abierto                                       |
| Origen      | Validación del Preview `b499fe1` (WORKLOG del 26-11) y la WO de refinamiento                                                          |
| Motor de IA | Motor local por reglas (sin IA generativa, sin llamadas con costo, sin datos enviados fuera)                                          |
| Capturas    | `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-26/ux-refinement-002/{antes,despues}` (fuera de Git), primera pantalla y página completa |

## 1. Hallazgos del Preview b499fe1 → resolución

| ID         | Hallazgo                                                           | Resolución (local)                                                                                                                            | Prueba                                          |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| HF-HOME-01 | Home centrada en conversaciones; «Sin hallazgos»; alcance mezclado | Home rediseñada: cabecera ejecutiva, KPI por red, Executive Brief, destacadas con motivo, Content performance por red, reputación como módulo | E2E Home; unitarias del brief                   |
| HF-UX-16   | Distribución apretada a ≥ 1 536 px; leyenda duplicada              | Anillo sin leyenda propia + barras en una línea; `stacked` en contenedores estrechos; el detalle ya no la pone a media anchura                | E2E en 6 anchos (altura de fila)                |
| HF-AI-12   | Engagement comparado entre redes; confianza en hechos              | Nada se ordena entre redes; resúmenes por red con su definición; `normalizeFinding` quita la confianza de los hechos para cualquier proveedor | Unitarias (ranking, brief, todas las preguntas) |
| HF-UX-15   | Tooltip recortado                                                  | Tarjeta sin `overflow-hidden`; tooltip al ancho de la tarjeta                                                                                 | E2E: visible, dentro de pantalla, sin tapar     |
| HF-UX-17   | Columna fija más alta que la pantalla                              | Sin columnas fijas; publicación junto a las visualizaciones                                                                                   | E2E: ningún ancestro `sticky`                   |
| HF-UX-19   | Brand Brain: periodo perdido y pantalla en blanco al guardar       | Guardado sin redirección (`useActionState`): confirma versión y fecha en la propia página                                                     | E2E: conserva `periodo=7d`                      |
| HF-AI-13   | Preguntas razonables no reconocidas; «próxima semana» = ranking    | Nuevas intenciones (guardados, alcance, priorizar, próxima semana, cumplimiento de estrategia); propuesta por red; respuesta principal        | Unitarias (8 intenciones, guardados, propuesta) |
| HF-BB-02   | Sin interfaz para validar aprendizajes                             | Revisión humana: evidencia, aprobar, rechazar con motivo, archivar, autor, revisor, historial                                                 | E2E + unitarias + 15 aserciones SQL de 0008     |
| HF-UX-18   | Reputación repite el título                                        | Motivo reescrito; estados de `CoverageStatus`                                                                                                 | Unitaria                                        |
| HF-UX-20   | Hook y CTA iguales en copy de una frase                            | El CTA se recorta desde el verbo de acción o se indica «Incluido en la frase del hook»; los hooks de la A/B no se repiten                     | Unitaria                                        |
| HF-UX-21   | Clásico sin aviso de privacidad en comentarios                     | Aviso en el detalle clásico                                                                                                                   | Tipos (los datos demo son sintéticos)           |
| HF-BB-03   | Brand Brain de organización demo con `is_synthetic = false`        | El guardado marca `is_synthetic` según la organización y registra el autor                                                                    | Unitaria                                        |

También: Social Explorer sumaba el alcance de Instagram y las impresiones únicas de Facebook en su resumen; ahora muestra cada red.

## 2. Qué se implementó por fase

- **A. Intelligence Home.** Cabecera ejecutiva (marca, periodo, fuentes, última medición, «Preguntar a Foxy»). KPI de Publicaciones y Redes conectadas, y por red: alcance o impresiones únicas acumulado (rotulado como suma por publicación), engagement mediano con su definición, impresiones e interacciones según la red. Foxy Executive Brief (3–5 hallazgos con evidencia, limitación y acceso). Brand Brain con objetivos, pilares, campañas y aprendizajes, o un estado vacío útil. Publicaciones destacadas con miniatura y motivo verificable. Content performance por red (engagement por formato, engagement de cada publicación por fecha, distribución de interacciones). Reputación con estados diferenciados.
- **B. Detalle.** Orden de la WO: cabecera y navegación → 4 KPI → publicación original → distribución → rendimiento comparable → evolución → Foxy Intelligence → comentarios y cobertura.
- **C. Foxy Intelligence.** Pestañas reales (solo la activa), Resumen con 3–5 hallazgos y recomendaciones, evidencia expandible, hechos sin confianza.
- **D. Visualizaciones.** InteractionBreakdown corregido, PerformanceComparison (misma red y formato, muestra visible), comparación por formato, históricos sin interpolar, tooltips corregidos.
- **E. Ask Foxy.** Copiloto lateral en todas las pantallas V2 (Home, Explorer, detalle, Brand Brain, Ask Foxy) con el contexto de la pantalla; pantalla completa en móvil; conversación conservada por contexto; respuesta principal, evidencias, limitaciones, recomendaciones y seguimiento; turnos preparados para streaming. Ask Foxy general sigue como módulo.
- **F. Brand Brain.** Guardado sin redirección, autor y versión visibles, organización sintética identificada, guía «Empieza por lo esencial», revisión humana de aprendizajes. Migración **0008** preparada y probada solo en local.
- **G. Design System v0.4.** Ver `design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md`.

## 3. Migración 0008 (pendiente de GO)

`supabase/migrations-pending/20261126000800_hf_brand_memory_review.sql` (+ rollback). Añade el estado `rejected` con motivo obligatorio, `reviewed_by` y `reviewed_at`, transiciones válidas en la base y contenido propuesto inmutable. No cambia la RLS. `scripts/test-migration-0008.sh`: idempotencia, 15 aserciones (roles, RLS entre organizaciones, transiciones, motivo), rollback exacto a 0007 por huella. Sin 0008, la interfaz permite aprobar y archivar, y deshabilita «Rechazar» explicando que falta la migración. Activación: aplicar 0008 en heyfoxy-qa con GO y crear `HF_MIGRATION_0008_APPLIED=true` en Preview.

## 4. Resultados de pruebas (local)

| Suite                            | Resultado                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Unitarias e integración (vitest) | 218 superadas, 4 omitidas (Postgres opcional); 27 nuevas de esta WO                 |
| Tipos (tsc), ESLint, Prettier    | Sin errores                                                                         |
| Contrato e aislamiento de datos  | `test-db.sh`: DB TESTS PASSED, ALL ISOLATION TESTS PASSED                           |
| Migración 0007                   | 23 aserciones, rollback a 0006 exacto                                               |
| Migración 0008                   | 15 aserciones, rollback a 0007 exacto                                               |
| Playwright (8 proyectos)         | 195 superadas, 0 fallidas; 5 pruebas nuevas en 6 anchos                             |
| Accesibilidad (axe WCAG A/AA)    | 0 violaciones graves; deuda conocida sin cambios (vacía), copiloto abierto incluido |
| Regresión visual                 | Referencias V2 regrabadas tras revisión; tema clásico sin diferencias               |

Durante la validación aparecieron y se corrigieron: un error de hidratación del copiloto (su texto se renderizaba antes del contexto de la pantalla), el panel visible cerrado, un tooltip que salía de la pantalla en móvil y un contraste insuficiente del botón «Aprobar» en oscuro (1,65:1; no se aceptó como deuda).

## 5. Limitaciones y pendientes

- Validado con la demo sintética (3 publicaciones en 3 redes): base pequeña. La composición con 14 publicaciones reales de MedPlus se verá en el próximo Preview.
- El motor sigue siendo por reglas: las preguntas abiertas requieren el proveedor de IA (doc 22, pendiente de GO).
- Carrusel: Metricool solo entrega la portada. Identidad (handle y avatar) pendiente de la próxima sincronización autorizada.
- 0008 sin aplicar en remoto; sin ella no se puede rechazar con motivo en el Preview.
- Datos de prueba que siguen en heyfoxy-qa (Clínica Aurora): contexto «[PRUEBA QA]» versión 2 y 1 aprendizaje propuesto. No se borraron.

## 6. GO necesarios

1. GO de Preview por SHA exacto.
2. GO para aplicar 0008 en heyfoxy-qa y crear `HF_MIGRATION_0008_APPLIED`.
3. Opcional: GO para limpiar los datos de prueba de Clínica Aurora en QA.
