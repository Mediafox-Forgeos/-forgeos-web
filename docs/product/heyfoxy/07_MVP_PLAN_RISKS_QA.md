# Hey Foxy — 07 · Plan MVP de 14 días, backlog, riesgos y QA (Fase 7)

| Propiedad  | Valor                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Work order | WO-MFOX-HEYFOXY-001                                                                                 |
| Estado     | Gate 1 — PROPUESTA. El día 1 empieza con el GO de Gate 1 y las respuestas a las decisiones abiertas |
| Criterios  | AC08, AC09, AC12                                                                                    |

## 1. Cronograma (días hábiles)

| Días          | Entregable                                                                                                                                                                                                                                          | Gate interno                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0 (antes)** | Trámites externos en paralelo: confirmar Metricool Advanced + MedPlus; crear app Meta (modo desarrollo) y agregar a administradores de MedPlus como testers; iniciar verificación del negocio y número de WhatsApp; autorización escrita de MedPlus | Sin estos, los días 3–8 se corren                                      |
| 1–2           | Proyecto `heyfoxy-qa` (Supabase + Vercel), esquema base con RLS (organizaciones, marcas, membresías, fuentes, credenciales cifradas, cola de jobs, auditoría), pruebas de aislamiento, esqueleto Next.js con Auth                                   | Revisión de esquema y RLS                                              |
| 3–5           | Interfaz `SourceConnector` + **primer conector** (Metricool _o_ Meta Graph según decisión D-F1) + YouTube; ingesta idempotente, cursores, reintentos, panel de salud de fuentes; organización demo con datos sintéticos                             | Ingesta de MedPlus en QA sin duplicados (reprocesar 2× = mismas filas) |
| 6–8           | Motor IA (`classify_item`, `cluster_topics`, `daily_summary`) con salida validada; reglas de alerta y prioridad; plantillas WhatsApp enviadas a aprobación; envío 1:1 con número de prueba, idempotencia y consentimiento                           | Muestra etiquetada: acuerdo IA/humano medido                           |
| 9–11          | Command Center: resumen, sentimiento, publicaciones, temas, alertas, incidentes (FSM), revisión IA, configuración; resumen diario                                                                                                                   | Recorrido completo con datos MedPlus en QA                             |
| 12–14         | QA (matriz §4), revisión de seguridad, prueba de carga ligera, Production `heyfoxy-prod`, inicio del piloto con revisión humana diaria                                                                                                              | **Gate 2** (GO para Production)                                        |

### Dependencias externas que pueden extender el cronograma

| Dependencia                                                             | Plazo típico            | Impacto si se atrasa                                                                 |
| ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| Verificación del negocio en Meta + App Review (Instagram/Facebook live) | Días a semanas          | Piloto funciona en **modo desarrollo** con testers; la venta a otros clientes espera |
| Número WhatsApp de producción + nombre visible + plantillas             | Horas a días            | Se usa número de prueba (pocos destinatarios) o email como respaldo                  |
| Acceso API de Metricool (plan Advanced)                                 | Inmediato si ya se paga | Sin él, conector Meta directo                                                        |
| LinkedIn Community Management                                           | Discrecional, semanas   | Fuera del MVP                                                                        |
| Autorización formal de MedPlus                                          | Depende del cliente     | Sin ella no se conecta nada real: solo demo                                          |

### MVP mínimo si las aprobaciones se demoran

Organización MedPlus con **una fuente** (Metricool, o Meta en modo desarrollo) + YouTube; clasificación IA; alertas y resumen diario por **email + in-app**, y WhatsApp solo desde el número de prueba a destinatarios verificados; Command Center con resumen, publicaciones, alertas e incidentes. Banco de Occidente: demo pública (YouTube + Business Discovery) + datos de demostración etiquetados.

## 2. Backlog priorizado

| Prioridad | Ítem                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | Base multiempresa + RLS + pruebas de aislamiento · Credenciales cifradas · Cola de ingesta idempotente · Primer conector · Clasificación IA con esquema · Reglas de alerta con dedupe · Envío WhatsApp 1:1 con consentimiento · Resumen diario · Incidentes con FSM · Auditoría |
| P1        | YouTube · Revisión humana y métricas de calidad · Escalamiento · Panel de salud de fuentes · Temas y clusters · Presupuestos de IA/WhatsApp · Organización demo                                                                                                                 |
| P2        | Segundo conector (el no elegido) · X por uso · Comparación por red · Reportes PDF · Etiquetas de campaña · Respuestas por comandos WhatsApp                                                                                                                                     |
| Fase 2    | Integración MediaFOX OS (solicitud desde incidente; campañas desde Cronopost) · SSO · Facebook PPCA · Proveedor licenciado de menciones públicas · Grupos WhatsApp (si OBA) · Facturación del SaaS · LinkedIn/TikTok directos                                                   |

## 3. Matriz de riesgos

| #   | Riesgo                                                                                            | Prob. | Impacto  | Mitigación                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------- | ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | App Review de Meta tarda o se rechaza                                                             | Alta  | Alto     | Modo desarrollo para el piloto; Metricool como ruta alterna; casos de uso y video preparados desde el día 0                                               |
| R2  | Expectativa de "escuchar todo lo público" (incluidos comentarios de cuentas ajenas)               | Alta  | Alto     | Matriz de fuentes comunicada al cliente; demo honesta; proveedor licenciado en fase 2 con revisión legal                                                  |
| R3  | Falsos positivos que generan fatiga de alertas                                                    | Media | Alto     | Umbrales conservadores, mínimo absoluto + anomalía, revisión humana, cooldown y agrupación                                                                |
| R4  | Falsos negativos en crisis reales                                                                 | Media | Muy alto | Flags críticos con alerta inmediata, _recall_ como métrica principal, revisión diaria en el piloto                                                        |
| R5  | Fuga de datos entre organizaciones                                                                | Baja  | Muy alto | RLS + pruebas automáticas de aislamiento + revisión de seguridad en Gate 2                                                                                |
| R6  | Exposición de tokens de terceros                                                                  | Baja  | Muy alto | Cifrado de aplicación, sin políticas para `authenticated`, rotación, nunca en logs                                                                        |
| R7  | Incumplimiento de términos de plataformas o de protección de datos (Ley 1581 de 2012 en Colombia) | Media | Alto     | Solo APIs oficiales, minimización de datos personales, retención, eliminación en la fuente, acuerdo con el cliente, revisión legal antes de comercializar |
| R8  | Costos variables (X, IA) sin control                                                              | Media | Medio    | Presupuestos por organización, corte suave, métricas de costo por cliente                                                                                 |
| R9  | Cambios de API/precios de terceros (Metricool, X, WhatsApp)                                       | Media | Medio    | Conectores aislados tras interfaz; monitoreo de changelogs                                                                                                |
| R10 | Licencia de n8n para uso comercial                                                                | Media | Medio    | n8n fuera de la ruta crítica; validar licencia antes de usarlo con clientes                                                                               |
| R11 | Plan Supabase: proyectos activos adicionales                                                      | Media | Bajo     | Confirmar plan y costo antes del día 1                                                                                                                    |
| R12 | Capacidad del equipo en paralelo con MediaFOX OS                                                  | Media | Medio    | Alcance mínimo viable definido; sin cambios en MediaFOX OS en esta WO                                                                                     |

## 4. Plan de QA

| Área        | Pruebas                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aislamiento | Usuario de A no lee/escribe B por UI, REST y RPC; `integration_credentials` ilegible para `authenticated`                                          |
| Roles       | Matriz de §5 de arquitectura, una prueba por celda                                                                                                 |
| Ingesta     | Reproceso 2× sin duplicados; reanudación tras fallo a mitad; edición de comentario → re-análisis una vez; eliminación en la fuente → texto purgado |
| IA          | Esquema válido 100 %; muestra etiquetada (acuerdo, _recall_ crítico); textos con datos personales enmascarados                                     |
| Alertas     | Dedupe por ventana; cooldown; anomalía no dispara con volumen absoluto bajo; flag crítico sí                                                       |
| WhatsApp    | Solo destinatarios con consentimiento; opt-out inmediato; idempotencia (reintento no duplica); franjas de silencio; respaldo email                 |
| Incidentes  | Transiciones válidas/ inválidas (FSM en servidor), historial completo                                                                              |
| UI          | Filtros, enlaces a evidencia, demo claramente marcada, escritorio/tablet/móvil                                                                     |
| Seguridad   | Firmas de webhooks, secretos fuera de logs, cabeceras, dependencias                                                                                |
| Operación   | Panel de salud, alertas internas por fuente caída, costos por organización                                                                         |

## 5. Rollback

Hey Foxy es un sistema separado: **revertirlo no afecta a MediaFOX OS**.

- **App**: re-promover el despliegue anterior en Vercel.
- **Base**: cada migración con su script `down`, ensayado en QA en transacción con rollback (mismo procedimiento que MediaFOX OS).
- **Fuentes**: interruptor por `data_source` y global para detener ingesta; revocación de tokens desde la plataforma de origen.
- **Notificaciones**: interruptor global de envíos (kill switch) y por organización.
- **Piloto**: si MedPlus lo solicita, desconexión de fuentes y eliminación de sus datos con constancia en `audit_logs`.
