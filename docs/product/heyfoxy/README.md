# Hey Foxy — Social Intelligence

Plataforma SaaS multiempresa de escucha social con IA, monitoreo reputacional, alertas por WhatsApp y gestión de incidentes. Producto independiente de MediaFOX Forge, integrable con MediaFOX OS por API.

| Propiedad  | Valor                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Work order | WO-MFOX-HEYFOXY-001 (P1) — Architecture & MVP Foundation                                                                            |
| Estado     | **Gate 1 — PROPUESTA, pendiente de aprobación.** Sin infraestructura, sin migraciones, sin cuentas conectadas, sin código funcional |
| Fecha      | 2026-11-12                                                                                                                          |
| Autor      | VULCAN                                                                                                                              |

## Documentos

| #   | Documento                                                                                   | Criterios                             |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| 01  | [Auditoría del ecosistema](./01_ECOSYSTEM_AUDIT.md)                                         | Entregable 1, límites con MediaFOX OS |
| 02  | [Matriz de fuentes de datos](./02_SOURCE_MATRIX.md)                                         | AC02                                  |
| 03  | [Arquitectura multiempresa, modelo de datos, seguridad e integración](./03_ARCHITECTURE.md) | AC01, AC03, AC10, AC11                |
| 04  | [Motor de inteligencia y WhatsApp Intelligence](./04_INTELLIGENCE_AND_WHATSAPP.md)          | AC04, AC05                            |
| 05  | [Command Center](./05_COMMAND_CENTER.md)                                                    | AC06                                  |
| 06  | [Piloto, modelo SaaS y costos](./06_PILOT_COMMERCIAL_COSTS.md)                              | AC07                                  |
| 07  | [Plan MVP de 14 días, backlog, riesgos, QA y rollback](./07_MVP_PLAN_RISKS_QA.md)           | AC08, AC09, AC12                      |

## Decisiones abiertas para Gate 1

| ID   | Pregunta                                       | Recomendación                                                                             |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1   | ¿Dónde vive el código?                         | `apps/heyfoxy-web` en este monorepo                                                       |
| D2   | ¿Base de datos?                                | Proyecto Supabase propio (QA y Production)                                                |
| D-F1 | ¿Primer conector del piloto MedPlus?           | Metricool si hay plan Advanced con MedPlus; si no, app Meta en modo desarrollo            |
| D4   | ¿Proveedor IA?                                 | Model Router con proveedor por variable (OpenAI directo hoy, Gateway cuando haya crédito) |
| D5   | ¿WhatsApp?                                     | Cloud API de Meta directo, mensajes 1:1 con plantillas de utilidad; sin grupos en el MVP  |
| D6   | ¿Titular de la app Meta y del número WhatsApp? | Portafolio Meta Business de MediaFOX (verificado)                                         |
| D7   | ¿n8n?                                          | Opcional y fuera de la ruta crítica, tras revisar su licencia                             |
