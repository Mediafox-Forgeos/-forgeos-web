# Hey Foxy — Social Intelligence

Plataforma SaaS multiempresa de escucha social con IA, monitoreo reputacional, alertas por WhatsApp y gestión de incidentes. Producto independiente de MediaFOX Forge, integrable con MediaFOX OS por API.

| Propiedad  | Valor                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Work order | WO-MFOX-HEYFOXY-001 (P1) — Architecture & MVP Foundation                                                                        |
| Estado     | **Gate 2 en curso** (Gate 1 aprobado con condiciones). Código en `apps/heyfoxy-web`; sin cuentas reales, sin Production pública |
| Fecha      | 2026-11-12                                                                                                                      |
| Autor      | VULCAN                                                                                                                          |

## Documentos

| #   | Documento                                                                                                                           | Criterios                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 00  | [Visión de producto: copiloto de inteligencia estratégica](./00_PRODUCT_VISION.md)                                                  | Producto                              |
| 01  | [Auditoría del ecosistema](./01_ECOSYSTEM_AUDIT.md)                                                                                 | Entregable 1, límites con MediaFOX OS |
| 02  | [Matriz de fuentes de datos](./02_SOURCE_MATRIX.md)                                                                                 | AC02                                  |
| 03  | [Arquitectura multiempresa, modelo de datos, seguridad e integración](./03_ARCHITECTURE.md)                                         | AC01, AC03, AC10, AC11                |
| 04  | [Motor de inteligencia y WhatsApp Intelligence](./04_INTELLIGENCE_AND_WHATSAPP.md)                                                  | AC04, AC05                            |
| 05  | [Command Center](./05_COMMAND_CENTER.md)                                                                                            | AC06                                  |
| 06  | [Piloto, modelo SaaS y costos](./06_PILOT_COMMERCIAL_COSTS.md)                                                                      | AC07                                  |
| 07  | [Plan MVP de 14 días, backlog, riesgos, QA y rollback](./07_MVP_PLAN_RISKS_QA.md)                                                   | AC08, AC09, AC12                      |
| 08  | [Metricool: capacidades verificadas y conexión segura](./08_METRICOOL_CONNECTION.md)                                                | Gate 2                                |
| 09  | [Gate 2: estado, infraestructura y plan](./09_GATE2_STATUS.md)                                                                      | Gate 2                                |
| 10  | [Supabase QA: procedimiento, presupuesto, migraciones y pruebas](./10_SUPABASE_QA_PROCEDURE.md)                                     | Gate 2                                |
| 11  | [Inventario definitivo del esquema (migraciones 0001–0005)](./11_SCHEMA_INVENTORY.md)                                               | Gate 2                                |
| 12  | [Usuarios QA, credenciales privadas y acceso al Preview](./12_QA_USERS_AND_ACCESS.md)                                               | Gate 2                                |
| 13  | [V2: arquitectura UX/UI, decisiones y Work Orders](./13_V2_UX_UI_ARCHITECTURE.md)                                                   | V2                                    |
| 14  | [V2: plan detallado por fases](./14_V2_PHASE_PLAN.md)                                                                               | V2                                    |
| 15  | [V2: revisión de Intelligence Home y Social Explorer (antes/después y pruebas)](./15_V2_REVIEW_HOME_EXPLORER.md)                    | V2                                    |
| 16  | [WO Metricool Advanced: campos por red, modelo de datos y conexión segura (preparada)](./16_WO_HF_METRICOOL_INTEGRATION.md)         | Metricool                             |
| 17  | [V2: refinamiento de Home y Social Explorer (WO-HF-V2-REFINEMENT-001)](./17_V2_REFINEMENT_001.md)                                   | V2                                    |
| 18  | [Metricool: integración local, cobertura, 0006 y procedimiento de conexión](./18_METRICOOL_INTEGRATION_001.md)                      | Metricool                             |
| 19  | [GO 1 Metricool: 0006 en QA, guardas de marca y emergencia, Explorer con medios](./19_GO1_METRICOOL_ACTIVATION.md)                  | Metricool                             |
| 20  | [Piloto MedPlus: autorización, tratamiento de datos y límites de la primera sincronización](./20_MEDPLUS_PILOT_AUTHORIZATION.md)    | Metricool                             |
| 21  | [WO-HF-V2-INTELLIGENCE-001: estabilización Metricool, Foxy Intelligence, Ask Foxy y Brand Brain](./21_WO_HF_V2_INTELLIGENCE_001.md) | Inteligencia                          |
| DS  | [Design System V2 v0.3](./design-system/HEY_FOXY_V2_DESIGN_SYSTEM.md) · [concepto](./design-system/HEY_FOXY_V2_CONCEPT.png)         | V2                                    |
| —   | [WORKLOG](./WORKLOG.md) · [TECH_BACKLOG](./TECH_BACKLOG.md)                                                                         | Seguimiento                           |

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
