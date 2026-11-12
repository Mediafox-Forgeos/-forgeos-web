# Hey Foxy — 04 · Motor de inteligencia y WhatsApp Intelligence (Fases 3 y 4)

| Propiedad  | Valor               |
| ---------- | ------------------- |
| Work order | WO-MFOX-HEYFOXY-001 |
| Estado     | Gate 1 — PROPUESTA  |
| Criterios  | AC04, AC05          |

## Parte A — Motor de inteligencia

### A1. Tareas IA (Model Router)

| Tarea            | Entrada                                                                     | Salida estructurada                                                                                                                                                                                                                                                                         | Modelo        |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `classify_item`  | Lote de 20–50 comentarios/menciones + contexto de la publicación y la marca | Por elemento: `sentiment` (positivo, neutral, negativo, ambiguo), `intent` (consulta, queja, felicitación, sugerencia, solicitud_ayuda, spam, otro), `topics[]`, `severity` 0–3, `confidence` 0–1, `rationale` (1 frase), `flags` (riesgo legal, salud, datos personales, amenaza, insulto) | Pequeño       |
| `cluster_topics` | Elementos del día con temas                                                 | Temas recurrentes normalizados + grupos de conversación relacionados                                                                                                                                                                                                                        | Pequeño/medio |
| `daily_summary`  | Agregados + top casos                                                       | Resumen ejecutivo, hallazgos, recomendaciones, casos pendientes                                                                                                                                                                                                                             | Medio         |
| `incident_brief` | Alerta + evidencia                                                          | Explicación del caso, impacto estimado, acción recomendada                                                                                                                                                                                                                                  | Medio         |

Reglas de implementación:

- **Salida validada con esquema** (rechazo y reintento si no cumple). Nunca texto libre en campos que alimentan reglas.
- **Versionado**: cada análisis guarda `model`, `prompt_version` y `analysis_version`; re-analizar crea una versión nueva, no sobreescribe.
- **Contexto de marca**: glosario y temas sensibles por organización (ej. salud → reclamos de cobertura, autorizaciones, citas). Idioma principal español (Colombia), con jerga y emojis.
- **Explicabilidad** (función 9): `rationale` + reglas que dispararon la alerta guardadas en `alerts.evidence` y visibles en la interfaz ("por qué Foxy marcó esto").
- **Privacidad**: no se envían al modelo teléfonos ni documentos detectados; se enmascaran antes.

### A2. Prioridad reputacional — no toda opinión negativa es crisis

Puntaje por elemento:

```
prioridad = severidad_base(intención, flags)        # queja < queja con riesgo legal/salud < amenaza
          × factor_alcance(publicación, autor si es público)
          × factor_confianza(confidence)             # < 0,6 → no alerta automática, va a revisión
```

Señales agregadas (por marca, ventana de 1 h / 24 h):

- **Volumen anómalo**: comentarios negativos de la ventana vs línea base (media y desviación de las últimas 4 semanas, misma franja horaria). Alerta si z ≥ umbral **y** mínimo absoluto (evita alertar 3 vs 1).
- **Recurrencia**: mismo tema negativo en ≥ N publicaciones o ≥ N autores distintos.
- **Publicación con actividad inusual** (función 6): crecimiento de comentarios/interacciones por hora vs. sus pares (`post_metric_snapshots`).
- **Gravedad puntual**: un solo elemento con flag crítico (amenaza, riesgo legal, salud) y confianza alta → alerta individual.

Niveles: **Informativa** (resumen diario) · **Atención** (in-app + resumen) · **Alta** (WhatsApp al responsable) · **Crítica** (WhatsApp a responsable y escalamiento + incidente obligatorio).

### A3. Revisión humana (función 10)

- Todo lo que sería **Crítico**, o tiene `confidence < 0,6`, entra a "Revisión" antes de escalar (salvo flag de amenaza/seguridad, que alerta y pide revisión en paralelo).
- El analista confirma o corrige (sentimiento, intención, severidad); la corrección queda en `sentiment_analyses.review_verdict` y alimenta el conjunto de evaluación.
- **Métrica de calidad**: acuerdo IA/humano por clase; objetivo del piloto ≥ 85 % en sentimiento y ≥ 90 % de _recall_ en negativos críticos sobre una muestra etiquetada por MedPlus/MediaFOX.

### A4. Costos y límites

Lotes, deduplicación por `content_hash`, presupuesto por organización (ver arquitectura §7). Si el presupuesto se agota: solo se analizan elementos con señales de riesgo (palabras clave + volumen) y se avisa al admin.

## Parte B — WhatsApp Intelligence

### B1. Verificación previa de la plataforma (resultado de la investigación)

| Tema                              | Hallazgo                                                                                                                                                                                                  | Consecuencia para el diseño                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mensajes iniciados por la empresa | Fuera de la ventana de 24 h solo se permiten **plantillas aprobadas** (utilidad, marketing, autenticación). Una respuesta del destinatario abre una ventana de 24 h para mensajes libres                  | Alertas y resumen diario = **plantillas de utilidad**; el detalle y la conversación ocurren dentro de la ventana que abre el destinatario al responder |
| Consentimiento                    | El destinatario debe haber aceptado recibir mensajes (opt-in)                                                                                                                                             | Registro explícito en `whatsapp_recipients.consent_at/consent_source`; opt-out con la palabra "BAJA" o botón                                           |
| Precio                            | Por mensaje entregado desde jul-2025; Colombia: utilidad ≈ USD 0,0008–0,001, marketing ≈ USD 0,0125–0,015 (fuentes secundarias; **confirmar en la tarifa oficial de Meta**)                               | Costo marginal de alertas casi nulo; se mide por envío                                                                                                 |
| **Grupos**                        | La Groups API de Cloud API existe, pero **requiere Official Business Account (OBA)**, máximo **8 participantes**, solo por **enlace de invitación** (no se agrega gente), una empresa Cloud API por grupo | **No se usa en el MVP.** Diseño principal: **mensajes individuales** a cada destinatario autorizado. Grupos como opción futura si MediaFOX obtiene OBA |
| Número                            | Cuenta de prueba de Cloud API envía a un número reducido de destinatarios verificados; producción requiere negocio verificado y nombre visible aprobado                                                   | QA con número de prueba; piloto con número propio de Hey Foxy                                                                                          |

### B2. Plantillas propuestas (categoría utilidad, español)

| Plantilla           | Uso                                                                                                                                          | Botones de respuesta rápida          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `hf_alerta_critica` | "Foxy detectó {{n}} comentarios con {{tema}} en {{red}} de {{marca}} en la última hora. Prioridad {{nivel}}."                                | Ver caso · Asignarme · Silenciar 2 h |
| `hf_alerta_tema`    | Incremento inusual de negatividad o conversación relevante                                                                                   | Ver caso · Asignarme                 |
| `hf_oportunidad`    | Oportunidad detectada (felicitaciones, tendencia positiva)                                                                                   | Ver                                  |
| `hf_resumen_diario` | "Resumen de {{marca}} del {{fecha}}: {{publicaciones}} publicaciones, sentimiento {{pos}}/{{neu}}/{{neg}}, {{pendientes}} casos pendientes." | Ver resumen · Ver pendientes         |
| `hf_escalamiento`   | Caso sin atender después de {{x}} minutos                                                                                                    | Ver caso · Tomar caso                |

Pulsar un botón abre la ventana de 24 h: Foxy responde con el detalle (resumen, enlaces a publicaciones, recomendación) y acepta comandos simples (`asignar`, `resolver`, `nota …`) que se registran en `incident_events`. Los enlaces llevan a Hey Foxy (con sesión), nunca exponen datos sin autenticación.

### B3. Seguimiento de incidentes

- **Asignación**: regla por marca/tema/turno o manual; aviso al responsable.
- **Estados**: `open → acknowledged → in_progress → escalated → resolved → closed`, validados en servidor (FSM, primitiva ForgeOS).
- **Escalamiento**: si no hay `acknowledged` en X min (por nivel), avisa al siguiente de la cadena.
- **Cierre**: requiere nota de resolución; todo queda en `incident_events` (quién, cuándo, por qué canal).

### B4. Configuración por organización

Destinatarios autorizados (con consentimiento) · horarios y franjas de silencio (las críticas pueden atravesarlas si el admin lo permite) · umbrales por regla · frecuencia (inmediata, agrupada cada 15/60 min, solo resumen) · canal preferido (WhatsApp, email, in-app) · hora del resumen diario.

### B5. Confiabilidad

`notification_deliveries` con `idempotency_key` (regla + ventana + destinatario), reintentos con backoff, estados de entrega por webhook de WhatsApp, límite de mensajes por destinatario por hora (agrupa en vez de inundar) y respaldo por email si WhatsApp falla.
