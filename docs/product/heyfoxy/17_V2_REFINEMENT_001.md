# 17 — WO-HF-V2-REFINEMENT-001: refinamiento de Home y Social Explorer

| Propiedad | Valor                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| Fecha     | 2026-11-24                                                                                        |
| Rama      | `feat/heyfoxy-v2-uxui`. **Solo local; sin Preview nuevo ni Production.** Gate D abierto           |
| Origen    | Revisión del Preview V2 (`dpl_CCkrqpDzqUdJTLnVRqogogvzjQ27`, `cdbd36f`) con datos de `heyfoxy-qa` |
| Evidencia | Galería antes/después fuera de Git: `/Volumes/MediaFOX_DEV/QA/HeyFoxy/V2/2026-11-24-refinement/`  |

## Fase A — correcciones funcionales

| #   | Defecto del Preview                                          | Corrección                                                                                                                                                            | Prueba                                 |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Menú móvil recortado a la altura de la cabecera              | Portal sobre la raíz del shell (el `backdrop-filter` de la cabecera creaba el bloque contenedor del `fixed`)                                                          | E2E `menú móvil` (390, 500 px, oscuro) |
| 2   | Foxy sobre el saludo en tablet                               | Ilustración solo desde `lg` con espacio reservado                                                                                                                     | Capturas 820                           |
| 3   | Tooltips del riel recortados y scroll horizontal             | Tooltip `fixed` anclado al borde del riel; `overflow-x-hidden`; scroll fino                                                                                           | E2E `riel de tablet`                   |
| 4   | Periodo perdido en cabecera; filtros al volver               | `PeriodLink` en marca, alertas y Foxy IA; filtros de Explorer validados (`lib/explorer-filters.ts`) y propagados                                                      | E2E + smoke + unitarias                |
| 5–6 | «−100 %» sin datos; «+43 pts» junto a «—»; 0 vs ausencia     | `compareWhen`: sin datos actuales → «Sin datos en el periodo»; «—» y motivo cuando no hay publicaciones o alcance                                                     | Unitarias                              |
| 7   | Foxy sugería acciones sin evidencia                          | `foxyActions`: cada acción exige un conteo real (> 0)                                                                                                                 | Unitarias                              |
| 8   | Se perdían análisis, prioridad y confianza de V1             | Fila de comentario con capa, temas, prioridad, confianza y explicación; origen honesto («Clasificación por reglas» para el clasificador heurístico)                   | Smoke                                  |
| 9   | Seed QA: 6 comentarios en una red distinta de su publicación | `qa_seed.sql` corregido; script `qa_fix_001_comment_platform.sql` **preparado, no ejecutado** (md5 `dc3bdb9f0b369c7923d7a249f906ee7b`); invariante en prueba unitaria | Unitarias                              |

## Fase B — refinamiento visual

- KPI compactas (icono + etiqueta, cifra con variación en línea): **seis en una fila** desde 1280 px; gráficos visibles en la primera pantalla (prueba E2E).
- Cobertura en una línea plegable; saludo compacto; rejillas con `items-start` (sin tarjetas estiradas).
- Fondos de módulo con banda tonal más larga (`--mod-home` lavanda, `--mod-explorer` azul).
- Evolución con serie de negativas y pico destacado; sentimiento con iconos; canales como mosaicos con logo oficial, % y conteo; temas más densos.
- Foxy ancho (hallazgos en dos columnas y acciones como botones) en Home y en el detalle.
- Publicaciones sin medios: franja compacta «Sin vista previa» en lugar de un bloque vacío; pie con interacciones y comentarios.
- Login con el Design System V2 (el tema clásico conserva el login V1).
- Selector de organización con icono y nombre completo (hasta dos líneas).
- Aviso de datos sintéticos con tokens de advertencia (visible, no estridente) en V2; el tema clásico no cambia.

## Resultado de las pruebas

| Prueba                              | Resultado                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Typecheck y lint                    | Verde                                                                               |
| Unitarias                           | **96/96** (+8: comparaciones, acciones de Foxy, filtros, invariante del seed)       |
| SQL local                           | Batería de aislamiento y contrato OK (sin cambios de esquema)                       |
| Build demo y Supabase (relleno)     | Verde; `check-trace` OK                                                             |
| Smoke HTTP                          | **54/54** (+5)                                                                      |
| QA Playwright                       | **168 passed, 30 skipped** en 9 proyectos (nuevo 500 px) + 4 pruebas de interacción |
| axe WCAG 2.2 A/AA graves o críticas | 0 (deuda vacía)                                                                     |
| Desbordamiento horizontal           | 0 (390, 500, 820, 1440)                                                             |
| Contraste de tokens                 | AA, claro y oscuro                                                                  |
| Capturas del tema clásico           | Sin cambios                                                                         |

## Pendientes

- Gate D abierto; nada de esta WO está desplegado (requiere GO por SHA).
- Aplicar `qa_fix_001` en `heyfoxy-qa` (GO con md5) y decidir si se recarga el seed: sus fechas son relativas al día de carga (10–14 nov), por eso el periodo de 7 días aparece vacío en el Preview.
- Metricool: WO preparada en [16](./16_WO_HF_METRICOOL_INTEGRATION.md).
- Observación: los bloques con `useSearchParams` (riel y selector de periodo) se transmiten tras el HTML inicial; una captura inmediata puede salir sin ellos (HF-UX-06).
