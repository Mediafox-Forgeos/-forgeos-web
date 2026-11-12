# Hey Foxy — 05 · Command Center (Fase 5)

| Propiedad  | Valor                                                |
| ---------- | ---------------------------------------------------- |
| Work order | WO-MFOX-HEYFOXY-001                                  |
| Estado     | Gate 1 — alcance funcional (sin diseño visual final) |
| Criterio   | AC06                                                 |

## 1. Pantallas

| #   | Vista                          | Contenido                                                                                                                                                                                                      | MVP                   |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | **Resumen general**            | KPIs del periodo: volumen de conversación, % por sentimiento y su variación, alertas abiertas por nivel, incidentes abiertos, tiempo medio de atención; "Lo que Foxy ve hoy" (3–5 hallazgos con recomendación) | ✓                     |
| 2   | **Evolución del sentimiento**  | Serie temporal apilada (positivo/neutral/negativo/ambiguo) por día u hora, con marcas de alertas                                                                                                               | ✓                     |
| 3   | **Publicaciones monitoreadas** | Tabla/tarjetas: red, fecha, interacciones, comentarios, sentimiento dominante, indicador de actividad inusual; detalle con comentarios clasificados                                                            | ✓                     |
| 4   | **Temas y tendencias**         | Temas recurrentes con volumen, sentimiento y tendencia; grupos de conversación relacionados                                                                                                                    | ✓ (básico)            |
| 5   | **Alertas prioritarias**       | Lista por nivel con evidencia y "por qué Foxy lo marcó"; acciones: revisar, crear incidente, descartar (con motivo)                                                                                            | ✓                     |
| 6   | **Incidentes abiertos**        | Tablero por estado (FSM), responsable, SLA, historial                                                                                                                                                          | ✓                     |
| 7   | **Mis casos**                  | Casos asignados al usuario                                                                                                                                                                                     | ✓                     |
| 8   | **Comparación por red**        | Volumen, sentimiento y tiempo de respuesta por red                                                                                                                                                             | Fase 2                |
| 9   | **Historial de alertas**       | Búsqueda y auditoría de alertas pasadas, incluidas las descartadas                                                                                                                                             | ✓ (lista simple)      |
| 10  | **Reportes ejecutivos**        | Resúmenes diarios generados; exportación PDF semanal/mensual                                                                                                                                                   | Diario ✓ / PDF fase 2 |
| —   | **Revisión IA**                | Cola de elementos para revisión humana                                                                                                                                                                         | ✓                     |
| —   | **Configuración**              | Fuentes, marcas, reglas, destinatarios WhatsApp, horarios, usuarios                                                                                                                                            | ✓                     |

## 2. Filtros globales

Empresa (solo `platform_staff` o usuarios con varias membresías) · Marca · Red social · Periodo (hoy, 7 d, 30 d, personalizado) · Campaña (etiqueta manual en MVP; desde MediaFOX OS en fase 2) · Sentimiento · Estado de incidente. Los filtros viven en la URL (compartibles) y respetan RLS.

## 3. Lineamientos de experiencia

- **Identidad propia de Hey Foxy** dentro de la familia MediaFOX: comparte tipografía, densidad y componentes del sistema de diseño, con paleta y logotipo propios (zorro "en escucha").
- Lo urgente primero: el resumen abre con alertas críticas y casos sin responsable.
- Toda cifra es navegable hasta la evidencia (comentario/publicación original con enlace a la red).
- **Datos de demostración** siempre marcados con una banda visible "DATOS DE DEMOSTRACIÓN" y nunca mezclados con datos reales en la misma organización.
- Escritorio primero, responsive para consulta móvil (el móvil es sobre todo el canal WhatsApp).
- Accesibilidad: contraste AA, estados no solo por color (íconos + texto para sentimiento).
